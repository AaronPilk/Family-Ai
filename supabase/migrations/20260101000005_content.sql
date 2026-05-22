-- forward
create table public.memory_items (
  id                  uuid primary key default gen_random_uuid(),
  circle_id           uuid not null references public.family_circles(id) on delete cascade,
  kind                text not null check (kind in (
                        'question','answer','post','comment',
                        'vault_message','imported_post','milestone'
                      )),
  author_user_id      uuid not null references public.users(id),
  body                text,
  body_tsv            tsvector generated always as (
                        to_tsvector('english', coalesce(body,''))
                      ) stored,
  context_note        text,
  related_question_id uuid references public.memory_items(id),
  parent_memory_id    uuid references public.memory_items(id),
  imported_source     jsonb,
  visibility_rule_id  uuid not null references public.visibility_rules(id),
  meta                jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create index memory_items_circle_created_idx on public.memory_items (circle_id, created_at desc);
create index memory_items_author_created_idx on public.memory_items (author_user_id, created_at desc);
create index memory_items_related_q_idx on public.memory_items (related_question_id);
create index memory_items_parent_idx on public.memory_items (parent_memory_id);
create index memory_items_kind_idx on public.memory_items (kind);
create index memory_items_body_fts_idx on public.memory_items using gin (body_tsv);

create table public.question_recipients (
  id                  uuid primary key default gen_random_uuid(),
  question_memory_id  uuid not null references public.memory_items(id) on delete cascade,
  recipient_user_id   uuid not null references public.users(id),
  status              text not null default 'pending'
                        check (status in ('pending','answered','dismissed','reminded')),
  answered_memory_id  uuid references public.memory_items(id),
  created_at          timestamptz not null default now(),
  answered_at         timestamptz,
  unique (question_memory_id, recipient_user_id)
);

create index question_recipients_user_status_idx
  on public.question_recipients (recipient_user_id, status);

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger memory_items_touch_updated_at
  before update on public.memory_items
  for each row execute function public.touch_updated_at();

-- rollback
-- drop trigger if exists memory_items_touch_updated_at on public.memory_items;
-- drop function if exists public.touch_updated_at();
-- drop table if exists public.question_recipients;
-- drop table if exists public.memory_items;
