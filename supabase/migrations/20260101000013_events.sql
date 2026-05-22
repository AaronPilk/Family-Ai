-- forward
-- =============================================================================
-- Batch 1B — Reunion Mode v0 (Events)
-- =============================================================================
-- Introduces the Event concept on top of family_circles. An Event:
--   - belongs to one host user and one primary circle
--   - can span MULTIPLE circles (cross-branch reunions: Pilks + Smiths at once)
--   - has guests drawn from immediate family, extended family, and
--     event-only invitees (someone who hasn't installed Kin yet)
--   - carries polls, a bring-list, a scoped photo/video feed, and an
--     auto-generated highlight reel at the end.
--
-- Also introduces:
--   - family_memberships.is_immediate    — viewer-declared immediate family flag
--   - relationships.is_extended_only     — relationship only via cross-event co-attendance
--
-- RLS for these tables: PLACEHOLDER. Real policies arrive in the next
-- hardening migration (Batch 1C). For v0 the mobile app uses mock data
-- and never touches these tables — the schema is intentionally landed
-- ahead of any client wiring so backups / migrations stay clean.
--
-- ROLLBACK: see bottom of file.

-- -----------------------------------------------------------------------------
-- 1. family_memberships.is_immediate
-- -----------------------------------------------------------------------------
-- "Immediate family" is a per-viewer designation. Aaron flags Mom as immediate
-- in HIS membership row for Mom's account in HIS circle. Mom's own membership
-- row in the same circle independently flags her immediate family.
-- We piggy-back on family_memberships rather than introducing a new table.

alter table public.family_memberships
  add column if not exists is_immediate boolean not null default false;

create index if not exists family_memberships_immediate_idx
  on public.family_memberships (user_id, is_immediate)
  where is_immediate = true;

comment on column public.family_memberships.is_immediate is
  'True if the user (auth.uid) has declared this membership-row member as immediate family (parent, sibling, grandparent). Excludes cousins.';

-- -----------------------------------------------------------------------------
-- 2. relationships.is_extended_only
-- -----------------------------------------------------------------------------

alter table public.relationships
  add column if not exists is_extended_only boolean not null default false;

comment on column public.relationships.is_extended_only is
  'True if this relationship exists only because the two users co-attended an event, not because either declared the other as immediate or non-immediate family during onboarding or invite.';

-- -----------------------------------------------------------------------------
-- 3. events
-- -----------------------------------------------------------------------------

create table if not exists public.events (
  id                  uuid primary key default gen_random_uuid(),
  host_user_id        uuid not null references public.users(id) on delete restrict,
  primary_circle_id   uuid not null references public.family_circles(id) on delete cascade,
  title               text not null,
  subtitle            text,
  kind                text not null
                       check (kind in ('reunion','vacation','holiday','gathering','other'))
                       default 'gathering',
  starts_at           date,
  ends_at             date,
  status              text not null
                       check (status in ('planning','upcoming','happening','past','cancelled'))
                       default 'planning',
  cover_tint          text,
  cover_glyph         text,
  location_text       text,
  invite_message      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create index events_primary_circle_idx on public.events (primary_circle_id);
create index events_status_starts_idx on public.events (status, starts_at);

-- Trigger to keep updated_at fresh.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_updated_at on public.events;
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. event_circles — cross-branch support
-- -----------------------------------------------------------------------------

create table if not exists public.event_circles (
  event_id    uuid not null references public.events(id) on delete cascade,
  circle_id   uuid not null references public.family_circles(id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (event_id, circle_id)
);

create index event_circles_circle_idx on public.event_circles (circle_id);

-- -----------------------------------------------------------------------------
-- 5. event_guests
-- -----------------------------------------------------------------------------

create table if not exists public.event_guests (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events(id) on delete cascade,
  -- user_id is nullable to support event-only guests who haven't installed Kin yet.
  user_id             uuid references public.users(id) on delete set null,
  invited_email       text,
  invited_phone       text,
  display_name        text not null,
  rsvp                text not null
                       check (rsvp in ('invited','going','maybe','no'))
                       default 'invited',
  is_host             boolean not null default false,
  invited_by_user_id  uuid references public.users(id) on delete set null,
  invited_at          timestamptz not null default now(),
  claimed_at          timestamptz,
  -- One of (user_id, invited_email, invited_phone) must be set so we know how to reach them.
  check (
    user_id is not null
    or invited_email is not null
    or invited_phone is not null
  )
);

create unique index event_guests_event_user_unique
  on public.event_guests (event_id, user_id) where user_id is not null;
create index event_guests_event_idx on public.event_guests (event_id);
create index event_guests_user_idx on public.event_guests (user_id) where user_id is not null;

-- -----------------------------------------------------------------------------
-- 6. event_bring_items
-- -----------------------------------------------------------------------------

create table if not exists public.event_bring_items (
  id                    uuid primary key default gen_random_uuid(),
  event_id              uuid not null references public.events(id) on delete cascade,
  item_text             text not null,
  claimed_by_user_id    uuid references public.users(id) on delete set null,
  checked               boolean not null default false,
  created_by_user_id    uuid references public.users(id) on delete set null,
  created_at            timestamptz not null default now()
);

create index event_bring_items_event_idx on public.event_bring_items (event_id);

-- -----------------------------------------------------------------------------
-- 7. event_polls + event_poll_options + event_poll_votes
-- -----------------------------------------------------------------------------

create table if not exists public.event_polls (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events(id) on delete cascade,
  kind                text not null
                       check (kind in ('date','location','activity','custom')),
  prompt              text not null,
  multiple_choice     boolean not null default false,
  closes_at           timestamptz,
  created_by_user_id  uuid references public.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index event_polls_event_idx on public.event_polls (event_id);

create table if not exists public.event_poll_options (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references public.event_polls(id) on delete cascade,
  label       text not null,
  subtitle    text,
  tint        text,
  position    int not null default 0
);

create index event_poll_options_poll_idx on public.event_poll_options (poll_id, position);

create table if not exists public.event_poll_votes (
  option_id     uuid not null references public.event_poll_options(id) on delete cascade,
  voter_user_id uuid not null references public.users(id) on delete cascade,
  voted_at      timestamptz not null default now(),
  primary key (option_id, voter_user_id)
);

create index event_poll_votes_voter_idx on public.event_poll_votes (voter_user_id);

-- -----------------------------------------------------------------------------
-- 8. event_media
-- -----------------------------------------------------------------------------

create table if not exists public.event_media (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events(id) on delete cascade,
  media_asset_id      uuid not null references public.media_assets(id) on delete cascade,
  caption             text,
  posted_by_user_id   uuid not null references public.users(id) on delete cascade,
  posted_at           timestamptz not null default now(),
  -- Optional: when set, this media is featured in the highlight reel.
  highlight_score     int
);

create index event_media_event_posted_idx on public.event_media (event_id, posted_at desc);
create index event_media_highlight_idx on public.event_media (event_id, highlight_score desc)
  where highlight_score is not null;

-- -----------------------------------------------------------------------------
-- 9. event_highlights
-- -----------------------------------------------------------------------------

create table if not exists public.event_highlights (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events(id) on delete cascade,
  generated_at        timestamptz not null default now(),
  body                jsonb not null,    -- structured: { media_ids: [], quotes: [], polls: [], chatter: [] }
  shared_url          text,
  unique (event_id)
);

-- -----------------------------------------------------------------------------
-- 10. RLS — placeholder. Real policies arrive in the next hardening migration.
-- -----------------------------------------------------------------------------

alter table public.events enable row level security;
alter table public.event_circles enable row level security;
alter table public.event_guests enable row level security;
alter table public.event_bring_items enable row level security;
alter table public.event_polls enable row level security;
alter table public.event_poll_options enable row level security;
alter table public.event_poll_votes enable row level security;
alter table public.event_media enable row level security;
alter table public.event_highlights enable row level security;

-- INTENTIONALLY DENY-BY-DEFAULT: no policies = no client access.
-- The mobile app uses mock data only for v0. When we wire real data we'll add:
--   - events_visible:        guest of the event OR member of primary_circle
--   - event_guests_visible:  guest of the same event
--   - event_*_insert:        gated by guest membership via SECURITY DEFINER fns
--   - event_media_insert:    must be a 'going' guest
-- See docs/REUNION-MODE.md §3 for the full plan.

revoke insert, update, delete on public.events                from authenticated, anon;
revoke insert, update, delete on public.event_circles         from authenticated, anon;
revoke insert, update, delete on public.event_guests          from authenticated, anon;
revoke insert, update, delete on public.event_bring_items     from authenticated, anon;
revoke insert, update, delete on public.event_polls           from authenticated, anon;
revoke insert, update, delete on public.event_poll_options    from authenticated, anon;
revoke insert, update, delete on public.event_poll_votes      from authenticated, anon;
revoke insert, update, delete on public.event_media           from authenticated, anon;
revoke insert, update, delete on public.event_highlights      from authenticated, anon;

-- rollback
-- drop table if exists public.event_highlights;
-- drop table if exists public.event_media;
-- drop table if exists public.event_poll_votes;
-- drop table if exists public.event_poll_options;
-- drop table if exists public.event_polls;
-- drop table if exists public.event_bring_items;
-- drop table if exists public.event_guests;
-- drop table if exists public.event_circles;
-- drop trigger if exists events_updated_at on public.events;
-- drop function if exists public.set_updated_at();
-- drop table if exists public.events;
-- drop index if exists family_memberships_immediate_idx;
-- alter table public.family_memberships drop column if exists is_immediate;
-- alter table public.relationships drop column if exists is_extended_only;
