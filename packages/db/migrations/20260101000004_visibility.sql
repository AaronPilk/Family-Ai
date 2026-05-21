-- forward
create table public.visibility_rules (
  id                          uuid primary key default uuid_generate_v4(),
  circle_id                   uuid not null references public.family_circles(id) on delete cascade,
  scope                       text not null check (scope in (
                                'only_me','specific_users','relationship_types',
                                'entire_circle','vault','future_release'
                              )),
  allowed_user_ids            uuid[] not null default '{}',
  allowed_relationship_types  text[] not null default '{}',
  created_by                  uuid not null references public.users(id),
  created_at                  timestamptz not null default now()
);

create index visibility_rules_circle_idx on public.visibility_rules (circle_id);

-- backfill the FK from profiles.default_visibility_rule_id now that the table exists
alter table public.profiles
  add constraint profiles_default_visibility_rule_fk
  foreign key (default_visibility_rule_id) references public.visibility_rules(id);

-- rollback
-- alter table public.profiles drop constraint if exists profiles_default_visibility_rule_fk;
-- drop table if exists public.visibility_rules;
