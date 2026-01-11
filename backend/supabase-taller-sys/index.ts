import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const DB_API_URL = Deno.env.get("DB_API_URL")!;
const DB_SERVICE_KEY = Deno.env.get("DB_SERVICE_KEY")!;
const WASENDER_API_KEY = Deno.env.get("WASENDER_API_KEY")!;

const WASENDER_URL = "https://wasenderapi.com/api/send-message";

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function dbFetch(path: string, init: RequestInit = {}) {
  const url = `${DB_API_URL.replace(/\/+$/, "")}/rest/v1/${path}`;
  return fetch(url, {
    ...init,
    headers: {
      apikey: DB_SERVICE_KEY,
      Authorization: `Bearer ${DB_SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return j({ ok: true });
    if (req.method !== "POST") return j({ ok: false, error: "Use POST" }, 
405);

    // Sanity: secrets
    if (!DB_API_URL || !DB_SERVICE_KEY || !WASENDER_API_KEY) {
      return j(
        {
          ok: false,
          error: "Missing env",
          DB_API_URL: Boolean(DB_API_URL),
          DB_SERVICE_KEY: Boolean(DB_SERVICE_KEY),
          WASENDER_API_KEY: Boolean(WASENDER_API_KEY),
        },
        500
      );
    }

    // 1) traer 1 pendiente
    const res = await dbFetch(
      
"notificaciones_outbox?estado_envio=eq.pendiente&limit=1&order=id.asc"
    );

    const resText = await res.text(); // leemos como texto SIEMPRE para 
debug
    if (!res.ok) {
      return j(
        { ok: false, error: "DB fetch failed", status: res.status, detail: 
resText },
        500
      );
    }

    let items: any;
    try {
      items = JSON.parse(resText);
    } catch {
      return j({ ok: false, error: "DB returned non-JSON", detail: resText 
}, 500);
    }

    if (!Array.isArray(items) || items.length === 0) {
      return j({ ok: true, processed: 0, enviados: 0, errores: 0 });
    }

    const n = items[0];

    // soportar columna "to" o "telefono"
    const toRaw = n?.to ?? n?.["to"] ?? n?.telefono ?? n?.phone ?? "";
    const msg = n?.mensaje ?? n?.text ?? n?.message ?? "";

    if (!toRaw || !msg) {
      // marcar error si podemos
      const id = n?.id;
      if (id != null) {
        await dbFetch(`notificaciones_outbox?id=eq.${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            estado_envio: "error",
            error_detalle: "Registro incompleto: falta 'to/telefono' o 
'mensaje'",
          }),
        });
      }
      return j({ ok: false, error: "Registro incompleto 
(to/telefono/mensaje)", sample: n }, 500);
    }

    const to = String(toRaw).replace(/\D/g, "");

    // 2) enviar a WaSender (api_key VA EN EL BODY)
    const wa = await fetch(WASENDER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: WASENDER_API_KEY,
        to,
        text: String(msg),
      }),
    });

    const waText = await wa.text();

    if (!wa.ok) {
      await dbFetch(`notificaciones_outbox?id=eq.${n.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          estado_envio: "error",
          error_detalle: waText,
        }),
      });
      return j({ ok: false, error: "WaSender failed", status: wa.status, 
detail: waText }, 500);
    }

    await dbFetch(`notificaciones_outbox?id=eq.${n.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        estado_envio: "enviado",
        sent_at: new Date().toISOString(),
        error_detalle: null,
      }),
    });

    return j({ ok: true, processed: 1, enviados: 1, errores: 0, wa: waText 
});
  } catch (e) {
    return j(
      {
        ok: false,
        error: "Unhandled exception",
        message: String(e?.message ?? e),
        stack: String(e?.stack ?? ""),
      },
      500
    );
  }
});

