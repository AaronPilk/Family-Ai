-- forward
create table public.family_circles (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  created_by    uuid not null references public.users(id),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create table public.family_memberships (
  id            uuid primary key default uuid_generate_v4(),
  circle_id     uuid not null references public.family_circles(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  role          text not null check (role in ('admin','member','co_pilot')),
  joined_at     timestamptz not null default now(),
  removed_at    timestamptz,
  unique (circle_id, user_id)
);

create index family_memberships_user_idx on public.family_memberships (user_id) where removed_at is null;
create index family_memberships_circle_idx on public.family_memberships (circle_id) where removed_at is null;

create table public.relationships (
  id                  uuid primary key default uuid_generate_v4(),
  circle_id           uuid not null references public.family_circles(id) on delete cascade,
  from_user_id        uuid not null references public.users(id),
  to_user_id          uuid not null references public.users(id),
  relationship_type   text not null check (relationship_type in (
                        'parent','child','grandparent','grandchild','sibling',
                        'spouse','aunt_uncle','niece_nephew','cousin',
                        'chosen_family','custom'
                      )),
  custom_label        text,
  confirmed_by_to     boolean not null default false,
  created_at          timestamptz not null default now(),
  unique (circle_id, from_user_id, to_user_id)
);

create table public.invites (
  id                          uuid primary key default uuid_generate_v4(),
  circle_id                   uuid not null references public.family_circles(id) on delete cascade,
  inviter_user_id             uuid not null references public.users(id),
  invitee_email               citext,
  invitee_phone               text,
  suggested_rel_from_inviter  text,
  suggested_rel_to_inviter    text,
  token                       text not null unique default encode(gen_random_bytes(24), 'base64'),
  status                      text not null default 'pending'
                                check (status in ('pending','accepted','expired','revoked')),
  created_at                  timestamptz not null default now(),
  expires_at                  timestamptz not null default (now() + interval '30 days')
);

create index invites_token_idx on public.invites (token);
create index invites_circle_idx on public.invites (circle_id);

-- rollback
-- drop table if exists public.invites;
-- drop table if exists public.relationships;
-- drop table if exists public.family_memberships;
-- drop table if exists public.family_circles;
