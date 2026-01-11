// supabase/functions/taller-dashboard/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// OJO: aquí NO usamos la palabra URL como nombre de variable
const PROJECT_URL = Deno.env.get("URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;

// Cliente con service role (solo del lado del servidor)
const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY);

// Headers CORS para permitir llamada desde el navegador
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request): Promise<Response> => {
  // Preflight de CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const urlObj = new URL(req.url);
    const tipo = urlObj.searchParams.get("tipo") ?? "tablero";

    let query = supabase.from("vw_taller_dashboard").select("*");

    if (tipo === "criticos") {
      query = query
        .eq("prioridad", "Alta")
        .eq("estado", "Pendiente")
        .order("dias_abierta", { ascending: false });
    } else if (tipo === "atrasados") {
      query = query
        .lt("dias_restantes", 0)
        .order("prioridad", { ascending: true })
        .order("dias_restantes", { ascending: true });
    } else {
      // tablero completo
      query = query
        .order("prioridad", { ascending: true })
        .order("dias_abierta", { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error en consulta vw_taller_dashboard:", error);
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        tipo,
        total: data?.length ?? 0,
        tareas: data ?? [],
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  } catch (e) {
    console.error("Error inesperado en taller-dashboard:", e);
    const msg =
      e instanceof Error
        ? e.message
        : (typeof e === "string" ? e : JSON.stringify(e));

    return new Response(
      JSON.stringify({
        ok: false,
        error: "Error interno en taller-dashboard: " + msg,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }
});
