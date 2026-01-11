import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

function j(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

async function sendWasender(to: string, text: string, apiKey: string, base: string) {
  const url = `${base.replace(/\/+$/,'')}/send-message`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to, text }),
  });
  const bodyText = await res.text();
  return { ok: res.ok, status: res.status, bodyText };
}

serve(async (req) => {
  const stamp = "DIRECT+QUEUE-V1";
  try {
    const apiKey = Deno.env.get("WASENDER_API_KEY") || "";
    const base = Deno.env.get("WASENDER_BASE_URL") || "https://wasenderapi.com/api";
    const supaUrl = Deno.env.get("SUPABASE_URL") || "";
    const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!apiKey) return j({ ok:false, error:"Missing WASENDER_API_KEY", stamp }, 500);

    // DIRECT si viene body
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const to = String(body?.to || "");
    const text = String(body?.text || body?.message || "");

    if (to && text) {
      const wa = await sendWasender(to, text, apiKey, base);
      if (!wa.ok) return j({ ok:false, sent:false, mode:"direct", error:`WaSender HTTP ${wa.status}`, waText: wa.bodyText.slice(0,400), stamp }, 500);
      return j({ ok:true, sent:true, mode:"direct", waStatus: wa.status, stamp }, 200);
    }

    // QUEUE si NO viene body
    if (!supaUrl || !srk) return j({ ok:false, error:"Missing Supabase secrets", stamp }, 500);

    // Tomar pendientes (máx 10)
    const pickUrl = `${supaUrl}/rest/v1/notificaciones_outbox?estado_envio=eq.pendiente&order=created_at.asc&limit=10`;
    const pickRes = await fetch(pickUrl, { headers: { apikey: srk, Authorization: `Bearer ${srk}` } });
    const rows = await pickRes.json();

    if (!rows?.length) return j({ ok:true, message:"Sin pendientes", mode:"queue", stamp }, 200);

    const results: any[] = [];
    for (const row of rows) {
      const id = row.id;
      const rowTo = String(row.to || row["to"] || "");
      const rowText = String(row.mensaje || "");
      if (!rowTo || !rowText) { results.push({ id, ok:false, error:"Fila sin to/mensaje" }); continue; }

      const wa = await sendWasender(rowTo, rowText, apiKey, base);

      const patch: any = {
        intentos: Number(row.intentos || 0) + 1,
        last_http_status: wa.status,
        last_response: wa.bodyText.slice(0,500),
        updated_at: new Date().toISOString(),
      };

      if (wa.ok) {
        patch.estado_envio = "enviado";
        patch.sent_at = new Date().toISOString();
        patch.next_retry_at = null;
        patch.error_detalle = null;
      } else {
        patch.estado_envio = "pendiente";
        patch.next_retry_at = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // +10 min
        patch.error_detalle = `WaSender HTTP ${wa.status}`;
      }

      await fetch(`${supaUrl}/rest/v1/notificaciones_outbox?id=eq.${id}`, {
        method: "PATCH",
        headers: { apikey: srk, Authorization: `Bearer ${srk}`, "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      results.push({ id, ok: wa.ok, status: wa.status });
    }

    return j({ ok:true, mode:"queue", processed: results.length, results, stamp }, 200);
  } catch (e) {
    return j({ ok:false, error:"Unhandled", detail:String(e?.message ?? e), stamp }, 500);
  }
});
