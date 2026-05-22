-- forward
create table public.vault_items (
  id                  uuid primary key default gen_random_uuid(),
  memory_id           uuid not null references public.memory_items(id) on delete cascade unique,
  creator_user_id     uuid not null references public.users(id),
  recipient_user_ids  uuid[] not null,
  release_rule        jsonb not null,
  status              text not null default 'sealed'
                        check (status in ('sealed','scheduled','released','revoked','awaiting_verification')),
  released_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index vault_items_status_idx on public.vault_items (status);
create index vault_items_creator_idx on public.vault_items (creator_user_id);

-- rollback
-- drop table if exists public.vault_items;
