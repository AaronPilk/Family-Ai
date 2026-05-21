-- forward
create table public.timelines (
  id            uuid primary key default uuid_generate_v4(),
  circle_id     uuid not null references public.family_circles(id) on delete cascade,
  kind          text not null check (kind in ('personal','relationship','family','topic')),
  owner_user_id uuid,
  pair_user_ids uuid[],
  topic_slug    text,
  title         text not null,
  created_at    timestamptz not null default now(),
  unique (circle_id, kind, owner_user_id, pair_user_ids, topic_slug)
);

create index timelines_circle_kind_idx on public.timelines (circle_id, kind);

create table public.timeline_placements (
  id            uuid primary key default uuid_generate_v4(),
  timeline_id   uuid not null references public.timelines(id) on delete cascade,
  memory_id     uuid not null references public.memory_items(id) on delete cascade,
  placed_at     timestamptz not null default now(),
  placed_by     text not null check (placed_by in ('rule','ai_tag','user_pin','vault_release')),
  unique (timeline_id, memory_id)
);

create index timeline_placements_timeline_idx
  on public.timeline_placements (timeline_id, placed_at desc);
create index timeline_placements_memory_idx
  on public.timeline_placements (memory_id);

-- rollback
-- drop table if exists public.timeline_placements;
-- drop table if exists public.timelines;
