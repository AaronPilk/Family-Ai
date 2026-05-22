-- forward
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  kind          text not null,
  payload       jsonb not null,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create table public.prompt_templates (
  id              uuid primary key default gen_random_uuid(),
  category        text not null,
  body            text not null,
  suggested_for_relationships text[] not null default '{}',
  weight          int not null default 1
);

create table public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  circle_id     uuid,
  action        text not null,
  target_kind   text,
  target_id     uuid,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

create index audit_log_circle_idx on public.audit_log (circle_id, created_at desc);

-- rollback
-- drop table if exists public.audit_log;
-- drop table if exists public.prompt_templates;
-- drop table if exists public.notifications;
