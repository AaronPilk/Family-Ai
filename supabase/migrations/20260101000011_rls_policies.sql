-- forward
-- =============================================
-- HELPERS
-- =============================================

-- True if `viewer_id` is an active member of `circle_id`.
create or replace function public.is_circle_member(viewer_id uuid, circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_memberships fm
    where fm.user_id = viewer_id
      and fm.circle_id = circle_id
      and fm.removed_at is null
  );
$$;

-- True if a visibility rule allows `viewer_id` to see an item authored by `author_id`.
create or replace function public.visibility_allows(
  viewer_id uuid,
  rule_id uuid,
  in_circle_id uuid,
  author_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when v.scope = 'entire_circle' then public.is_circle_member(viewer_id, in_circle_id)
    when v.scope = 'only_me' then viewer_id = author_id
    when v.scope = 'specific_users'
      then viewer_id = author_id or viewer_id = any(v.allowed_user_ids)
    when v.scope = 'relationship_types'
      then viewer_id = author_id or exists (
        select 1 from public.relationships r
        where r.circle_id = in_circle_id
          and r.from_user_id = author_id
          and r.to_user_id = viewer_id
          and r.relationship_type = any(v.allowed_relationship_types)
      )
    when v.scope = 'vault' then viewer_id = author_id
    when v.scope = 'future_release' then false
    else false
  end
  from public.visibility_rules v
  where v.id = rule_id;
$$;

-- =============================================
-- ENABLE RLS
-- =============================================
alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.family_circles enable row level security;
alter table public.family_memberships enable row level security;
alter table public.relationships enable row level security;
alter table public.invites enable row level security;
alter table public.visibility_rules enable row level security;
alter table public.memory_items enable row level security;
alter table public.question_recipients enable row level security;
alter table public.media_assets enable row level security;
alter table public.memory_media enable row level security;
alter table public.timelines enable row level security;
alter table public.timeline_placements enable row level security;
alter table public.vault_items enable row level security;
alter table public.transcriptions enable row level security;
alter table public.ai_tags enable row level security;
alter table public.embeddings enable row level security;
alter table public.prompt_suggestions enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- =============================================
-- USERS / PROFILES
-- =============================================
create policy users_self_read on public.users
  for select using (auth.uid() = id);

create policy profiles_self_read on public.profiles
  for select using (auth.uid() = user_id);

-- Members of any shared circle can see each other's profiles.
create policy profiles_circle_read on public.profiles
  for select using (
    exists (
      select 1
      from public.family_memberships me
      join public.family_memberships them
        on me.circle_id = them.circle_id
      where me.user_id = auth.uid()
        and them.user_id = public.profiles.user_id
        and me.removed_at is null
        and them.removed_at is null
    )
  );

create policy profiles_self_write on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy profiles_self_insert on public.profiles
  for insert with check (auth.uid() = user_id);

-- =============================================
-- FAMILY CIRCLES / MEMBERSHIPS / RELATIONSHIPS
-- =============================================
create policy family_circles_member_read on public.family_circles
  for select using (public.is_circle_member(auth.uid(), id));

create policy family_circles_create on public.family_circles
  for insert with check (auth.uid() = created_by);

create policy family_memberships_member_read on public.family_memberships
  for select using (public.is_circle_member(auth.uid(), circle_id));

create policy family_memberships_self_insert on public.family_memberships
  for insert with check (auth.uid() = user_id);

create policy relationships_member_read on public.relationships
  for select using (public.is_circle_member(auth.uid(), circle_id));

create policy relationships_self_write on public.relationships
  for insert with check (
    public.is_circle_member(auth.uid(), circle_id)
    and (auth.uid() = from_user_id or auth.uid() = to_user_id)
  );

-- =============================================
-- INVITES
-- =============================================
create policy invites_member_read on public.invites
  for select using (public.is_circle_member(auth.uid(), circle_id));

create policy invites_member_write on public.invites
  for insert with check (
    public.is_circle_member(auth.uid(), circle_id)
    and auth.uid() = inviter_user_id
  );

-- =============================================
-- VISIBILITY RULES
-- =============================================
create policy visibility_rules_member_read on public.visibility_rules
  for select using (public.is_circle_member(auth.uid(), circle_id));

create policy visibility_rules_member_write on public.visibility_rules
  for insert with check (
    public.is_circle_member(auth.uid(), circle_id)
    and auth.uid() = created_by
  );

-- =============================================
-- MEMORY ITEMS — the main policy
-- =============================================
create policy memory_items_visible on public.memory_items
  for select using (
    deleted_at is null and (
      auth.uid() = author_user_id
      or (
        public.is_circle_member(auth.uid(), circle_id)
        and public.visibility_allows(auth.uid(), visibility_rule_id, circle_id, author_user_id)
      )
    )
  );

create policy memory_items_author_write on public.memory_items
  for insert with check (
    auth.uid() = author_user_id
    and public.is_circle_member(auth.uid(), circle_id)
  );

create policy memory_items_author_update on public.memory_items
  for update using (auth.uid() = author_user_id)
  with check (auth.uid() = author_user_id);

-- =============================================
-- QUESTION RECIPIENTS
-- =============================================
create policy question_recipients_visible on public.question_recipients
  for select using (
    auth.uid() = recipient_user_id
    or exists (
      select 1 from public.memory_items q
      where q.id = question_memory_id and q.author_user_id = auth.uid()
    )
  );

create policy question_recipients_asker_write on public.question_recipients
  for insert with check (
    exists (
      select 1 from public.memory_items q
      where q.id = question_memory_id and q.author_user_id = auth.uid()
    )
  );

create policy question_recipients_recipient_update on public.question_recipients
  for update using (auth.uid() = recipient_user_id);

-- =============================================
-- MEDIA
-- =============================================
create policy media_assets_owner_or_referenced on public.media_assets
  for select using (
    auth.uid() = owner_user_id
    or exists (
      select 1
      from public.memory_media mm
      join public.memory_items m on m.id = mm.memory_id
      where mm.media_id = public.media_assets.id
        and (
          auth.uid() = m.author_user_id
          or (
            public.is_circle_member(auth.uid(), m.circle_id)
            and public.visibility_allows(auth.uid(), m.visibility_rule_id, m.circle_id, m.author_user_id)
          )
        )
    )
  );

create policy media_assets_owner_write on public.media_assets
  for insert with check (auth.uid() = owner_user_id);

create policy memory_media_via_memory on public.memory_media
  for select using (
    exists (select 1 from public.memory_items m where m.id = memory_id)
  );

create policy memory_media_author_write on public.memory_media
  for insert with check (
    exists (
      select 1 from public.memory_items m
      where m.id = memory_id and m.author_user_id = auth.uid()
    )
  );

-- =============================================
-- TIMELINES / PLACEMENTS
-- =============================================
create policy timelines_member_read on public.timelines
  for select using (public.is_circle_member(auth.uid(), circle_id));

create policy timeline_placements_visible on public.timeline_placements
  for select using (
    exists (
      select 1 from public.memory_items m
      where m.id = memory_id
        and (
          auth.uid() = m.author_user_id
          or (
            public.is_circle_member(auth.uid(), m.circle_id)
            and public.visibility_allows(auth.uid(), m.visibility_rule_id, m.circle_id, m.author_user_id)
          )
        )
    )
  );

-- =============================================
-- VAULT
-- =============================================
-- Only the creator can read a sealed/scheduled vault item; recipients can read once released
-- (the underlying memory_items row has its visibility rule swapped on release).
create policy vault_items_creator_or_released on public.vault_items
  for select using (
    auth.uid() = creator_user_id
    or (status = 'released' and auth.uid() = any(recipient_user_ids))
  );

create policy vault_items_creator_write on public.vault_items
  for insert with check (auth.uid() = creator_user_id);

-- =============================================
-- AI ARTIFACTS — readable iff the underlying memory is readable
-- =============================================
create policy transcriptions_via_media on public.transcriptions
  for select using (
    exists (select 1 from public.media_assets ma where ma.id = media_id)
  );

create policy ai_tags_via_memory on public.ai_tags
  for select using (
    exists (select 1 from public.memory_items m where m.id = memory_id)
  );

create policy embeddings_via_memory on public.embeddings
  for select using (
    exists (select 1 from public.memory_items m where m.id = memory_id)
  );

create policy prompt_suggestions_for_self on public.prompt_suggestions
  for select using (auth.uid() = for_user_id);

-- =============================================
-- NOTIFICATIONS / AUDIT
-- =============================================
create policy notifications_self on public.notifications
  for select using (auth.uid() = user_id);

create policy audit_log_circle_admin on public.audit_log
  for select using (
    exists (
      select 1 from public.family_memberships fm
      where fm.circle_id = public.audit_log.circle_id
        and fm.user_id = auth.uid()
        and fm.role = 'admin'
        and fm.removed_at is null
    )
  );

-- rollback
-- (Disable RLS + drop policies — omitted in template; recreate from a prior migration.)
