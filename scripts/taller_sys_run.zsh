set -euo pipefail

# ====== RELLENÁ ESTO (5 líneas) ======
PROJECT_REF="frxfhzpogtwyznjxdbnu"
SUPABASE_URL="https://frxfhzpogtwyznjxdbnu.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="PEGA_AQUI_SERVICE_ROLE_KEY"
WASENDER_API_KEY="PEGA_AQUI_WASENDER_API_KEY"
DB_URI="PEGA_AQUI_POSTGRES_URI"   # empieza con postgresql://...
# =====================================

WORKDIR="${HOME}/taller-sys-terminal"
FUNC_DIR="$WORKDIR/supabase/functions/encuesta-wa"

rm -rf "$WORKDIR"
mkdir -p "$FUNC_DIR"
cd "$WORKDIR"

cat > supabase/config.toml <<TOML
project_id = "$PROJECT_REF"
TOML

cat > "$FUNC_DIR/index.ts" <<'TS'
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
function j(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
serve(async () => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const WASENDER_API_KEY = Deno.env.get("WASENDER_API_KEY");
  if (!SUPABASE_URL || !SRK || !WASENDER_API_KEY) return j({ ok:false, error:"Missing secrets" }, 500);

  const pickUrl = `${SUPABASE_URL}/rest/v1/notificaciones_outbox?estado_envio=eq.pendiente&limit=1&order=created_at.asc`;
  const pickRes = await fetch(pickUrl, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } });
  const rows = await pickRes.json();
  if (!rows?.length) return j({ ok:true, message:"Sin pendientes" }, 200);
  const row = rows[0];

  const waRes = await fetch("https://api.wasender.co/send-message", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${WASENDER_API_KEY}` },
    body: JSON.stringify({ to: row.to, message: row.mensaje }),
  });

  const waText = await waRes.text();
  const waStatus = waRes.status;

  if (!waRes.ok) {
    await fetch(`${SUPABASE_URL}/rest/v1/notificaciones_outbox?id=eq.${row.id}`, {
      method: "PATCH",
      headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" },
      body: JSON.stringify({ estado_envio:"error", intentos:(row.intentos ?? 0)+1, last_http_status:waStatus, last_response:waText, error_detalle:`WaSender HTTP ${waStatus}` }),
    });
    return j({ ok:false, error:`WaSender HTTP ${waStatus}`, waText: waText.slice(0,200) }, 500);
  }

  await fetch(`${SUPABASE_URL}/rest/v1/notificaciones_outbox?id=eq.${row.id}`, {
    method: "PATCH",
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" },
    body: JSON.stringify({ estado_envio:"enviado", sent_at:new Date().toISOString(), last_http_status:waStatus, last_response:waText, error_detalle:null }),
  });

  return j({ ok:true, sent:true, id: row.id, waStatus }, 200);
});
TS

supabase login
supabase link --project-ref "$PROJECT_REF"

supabase secrets set SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  WASENDER_API_KEY="$WASENDER_API_KEY"

supabase functions deploy encuesta-wa --no-verify-jwt

psql "$DB_URI" <<SQL
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net;

alter system set app.settings.service_role_key = '$SUPABASE_SERVICE_ROLE_KEY';
select pg_reload_conf();

select cron.unschedule(jobid) from cron.job where jobname = 'worker_encuesta_wa';

select cron.schedule(
  'worker_encuesta_wa',
  '* * * * *',
  \$\$
  select net.http_post(
    url := 'https://$PROJECT_REF.functions.supabase.co/encuesta-wa',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || current_setting('app.settings.service_role_key', true),
      'apikey', current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  \$\$
);
commit;
SQL

psql "$DB_URI" <<'SQL'
insert into public.notificaciones_outbox (canal, "to", mensaje, estado_envio, intentos)
values ('whatsapp','50660457989','MENSAJE FINAL REAL ✅ ' || to_char(now(),'YYYY-MM-DD HH24:MI:SS'),'pendiente',0);
SQL

psql "$DB_URI" -c "select id, estado_envio, intentos, created_at, sent_at, last_http_status, left(coalesce(error_detalle,''),120) as err from public.notificaciones_outbox order by id desc limit 5;"
psql "$DB_URI" -c "select jobid, jobname, schedule, active from cron.job where jobname='worker_encuesta_wa';"
psql "$DB_URI" -c "select jobid, status, start_time, end_time, left(coalesce(return_message,''),200) as msg from cron.job_run_details order by start_time desc limit 5;"
