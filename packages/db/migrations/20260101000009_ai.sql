-- forward
create table public.transcriptions (
  id            uuid primary key default uuid_generate_v4(),
  media_id      uuid not null references public.media_assets(id) on delete cascade unique,
  language      text,
  text          text not null,
  segments      jsonb,
  engine        text not null,
  created_at    timestamptz not null default now()
);

create table public.ai_tags (
  id            uuid primary key default uuid_generate_v4(),
  memory_id     uuid not null references public.memory_items(id) on delete cascade,
  topic_slug    text not null,
  confidence    numeric(3,2) not null,
  source        text not null check (source in ('ai','user')),
  created_at    timestamptz not null default now(),
  unique (memory_id, topic_slug, source)
);

create table public.embeddings (
  memory_id     uuid primary key references public.memory_items(id) on delete cascade,
  embedding     vector(1536) not null,
  model         text not null,
  updated_at    timestamptz not null default now()
);

create index embeddings_ivfflat_idx
  on public.embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table public.prompt_suggestions (
  id                uuid primary key default uuid_generate_v4(),
  for_user_id       uuid not null references public.users(id),
  about_user_id     uuid not null references public.users(id),
  trigger_memory_id uuid references public.memory_items(id),
  text              text not null,
  status            text not null default 'pending'
                      check (status in ('pending','used','dismissed')),
  created_at        timestamptz not null default now()
);

create index prompt_suggestions_for_status_idx
  on public.prompt_suggestions (for_user_id, status);

-- rollback
-- drop table if exists public.prompt_suggestions;
-- drop table if exists public.embeddings;
-- drop table if exists public.ai_tags;
-- drop table if exists public.transcriptions;
