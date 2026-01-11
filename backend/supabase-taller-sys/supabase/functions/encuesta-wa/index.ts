import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const VERSION = "REAL-SEND-V1-NOAUTH";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function rpc(baseUrl: string, key: string, fn: string, payload: unknown) {
  const res = await fetch(`${baseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  });
  return { status: res.status, text: await res.text() };
}

async function patchRow(baseUrl: string, key: string, id: number, patch: Record<string, unknown>) {
  const res = await fetch(`${baseUrl}/rest/v1/notificaciones_outbox?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(patch),
  });
  return { status: res.status, text: await res.text() };
}

async function sendWhatsApp(to: string, text: string) {
  const apiKey = Deno.env.get("WASENDER_API_KEY")?.trim();
  if (!apiKey) return { ok: false, status: 500, body: "Missing WASENDER_API_KEY" };

  const res = await fetch("https://api.wasenderapi.com/api/send-message", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ to, text }),
  });

  return { ok: res.ok, status: res.status, body: await res.text() };
}

function addSeconds(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

serve(async () => {
  try {
    const DB_API_URL = Deno.env.get("DB_API_URL")?.trim();
    const DB_SERVICE_KEY = Deno.env.get("DB_SERVICE_KEY")?.trim();

    if (!DB_API_URL || !DB_SERVICE_KEY) {
      return json({ ok: false, step: "env", error: "Missing DB_API_URL or DB_SERVICE_KEY", version: VERSION }, 500);
    }

    const dq = await rpc(DB_API_URL, DB_SERVICE_KEY, "dequeue_notificacion_outbox", {
      p_worker: "edge-encuesta-wa",
    });

    if (dq.status !== 200) {
      return json({ ok: false, step: "dequeue", error: dq.text, version: VERSION }, 500);
    }

    const rows = JSON.parse(dq.text || "[]");
    if (!rows.length) {
      return json({ ok: true, step: "dequeue", message: "Sin tarea", version: VERSION }, 200);
    }

    const job = rows[0];
    const jobId = job.id;
    const now = new Date().toISOString();

    if (!job.to || !job.mensaje) {
      await patchRow(DB_API_URL, DB_SERVICE_KEY, jobId, {
        estado_envio: "error",
        error_detalle: "Faltan datos (to o mensaje)",
        locked_at: null,
        locked_by: null,
        updated_at: now,
      });
      return json({ ok: false, step: "validate", jobId, version: VERSION }, 500);
    }

    const ws = await sendWhatsApp(job.to, job.mensaje);

    if (ws.status === 429) {
      await patchRow(DB_API_URL, DB_SERVICE_KEY, jobId, {
        estado_envio: "pendiente",
        last_http_status: ws.status,
        last_response: ws.body,
        next_retry_at: addSeconds(6),
        locked_at: null,
        locked_by: null,
        updated_at: now,
      });
      return json({ ok: false, step: "send", jobId, wasender_status: 429, version: VERSION }, 429);
    }

    if (ws.ok) {
      await patchRow(DB_API_URL, DB_SERVICE_KEY, jobId, {
        estado_envio: "enviado",
        sent_at: now,
        last_http_status: ws.status,
        last_response: ws.body,
        locked_at: null,
        locked_by: null,
        updated_at: now,
        next_retry_at: null,
      });
      return json({ ok: true, step: "send", jobId, wasender_status: ws.status, version: VERSION }, 200);
    }

    await patchRow(DB_API_URL, DB_SERVICE_KEY, jobId, {
      estado_envio: "error",
      last_http_status: ws.status,
      last_response: ws.body,
      next_retry_at: addSeconds(900),
      locked_at: null,
      locked_by: null,
      updated_at: now,
    });

    return json({ ok: false, step: "send", jobId, wasender_status: ws.status, version: VERSION }, 500);
  } catch (e) {
    return json({ ok: false, step: "catch", error: String(e), version: VERSION }, 500);
  }
});
