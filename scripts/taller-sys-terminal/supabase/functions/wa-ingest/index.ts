import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const payload = await req.json();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(JSON.stringify({ ok: false, error: "missing_supabase_env" }), { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const TALLER_NUMBER = normPhone(Deno.env.get("TALLER_NUMBER"));
    const telefono = normPhone(pickInboundPhone(payload));

    // ---- BLINDAJES ----
    if (!telefono) return ok("ignored:no_telefono");
    if (isFromMe(payload)) return ok("ignored:fromMe");
    if (TALLER_NUMBER && telefono === TALLER_NUMBER) return ok("ignored:same_number");

    // ---- UPSERT CONVERSACIÓN ----
    await supabase.from("wa_conversaciones").upsert({
      telefono,
      estado: "nuevo",
      ultimo_mensaje_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // ---- INSERT MENSAJE (INBOUND) ----
    await supabase.from("wa_mensajes").insert({
      telefono,
      direction: "in",
      texto: extractText(payload),
      payload,
      provider: "wasender",
      provider_status: "stored",
    });

    // ---- MODO SEGURO: NO ENVIAR ----
    return ok("ingested_only");
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});

function ok(reason: string) {
  return new Response(JSON.stringify({ ok: true, reason }), { status: 200 });
}

function normPhone(v: unknown): string {
  return String(v ?? "").replace(/[^\d]/g, "");
}

function pickInboundPhone(p: any): string {
  return (
    p?.from ??
    p?.phone ??
    p?.sender?.phone ??
    p?.sender?.id ??
    p?.data?.from ??
    p?.data?.phone ??
    ""
  );
}

function isFromMe(p: any): boolean {
  return p?.fromMe === true || p?.data?.fromMe === true;
}

function extractText(p: any): string | null {
  return (
    p?.text ??
    p?.message ??
    p?.data?.text ??
    null
  );
}
