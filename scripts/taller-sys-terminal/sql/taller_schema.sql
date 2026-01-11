-- =========================================
-- Taller SyS - Inbox + Mensajes + Encuestas
-- =========================================

-- 1) Conversaciones (bandeja)
create table if not exists public.wa_conversaciones (
  telefono text primary key,
  estado text not null default 'nuevo',
  asignado_a text,
  tags text[],
  ultimo_mensaje_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wa_conversaciones_estado_idx
  on public.wa_conversaciones (estado);

create index if not exists wa_conversaciones_ultimo_mensaje_idx
  on public.wa_conversaciones (ultimo_mensaje_at desc);

-- 2) Mensajes (auditoría real de entrantes y salientes)
create table if not exists public.wa_mensajes (
  id bigserial primary key,
  telefono text not null,
  direction text not null check (direction in ('in','out')),
  texto text,
  payload jsonb,
  provider text not null default 'wasender',
  provider_msg_id text,
  provider_status text not null default 'stored' check (provider_status in ('stored','queued','sent','failed')),
  error_detail text,
  created_at timestamptz not null default now()
);

create index if not exists wa_mensajes_tel_created_idx
  on public.wa_mensajes (telefono, created_at desc);

alter table public.wa_mensajes
  add constraint wa_mensajes_tel_fk
  foreign key (telefono) references public.wa_conversaciones(telefono)
  on delete cascade;

-- 3) Cola de encuestas (clientes que NO escriben)
create table if not exists public.wa_survey_queue (
  id bigserial primary key,
  telefono text not null,
  orden_id text,
  placa text,
  servicio text,
  fecha_salida date,
  scheduled_at timestamptz,
  canal text not null default 'whatsapp' check (canal in ('whatsapp','sms','email')),
  estado text not null default 'pending' check (estado in ('pending','sent','failed','canceled')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists wa_survey_queue_estado_sched_idx
  on public.wa_survey_queue (estado, scheduled_at);
