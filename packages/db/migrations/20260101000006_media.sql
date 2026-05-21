-- forward
create table public.media_assets (
  id                  uuid primary key default uuid_generate_v4(),
  owner_user_id       uuid not null references public.users(id),
  circle_id           uuid not null references public.family_circles(id),
  kind                text not null check (kind in ('image','video','audio','document','screenshot')),
  storage_provider    text not null default 'supabase',
  storage_path        text not null,
  mime_type           text,
  bytes               bigint,
  duration_seconds    numeric,
  width               int,
  height              int,
  hls_playlist_url    text,
  blurhash            text,
  created_at          timestamptz not null default now()
);

create index media_assets_owner_idx on public.media_assets (owner_user_id);
create index media_assets_circle_idx on public.media_assets (circle_id);

create table public.memory_media (
  memory_id     uuid not null references public.memory_items(id) on delete cascade,
  media_id      uuid not null references public.media_assets(id) on delete cascade,
  position      int not null default 0,
  primary key (memory_id, media_id)
);

-- rollback
-- drop table if exists public.memory_media;
-- drop table if exists public.media_assets;
