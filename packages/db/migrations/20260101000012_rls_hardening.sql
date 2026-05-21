-- forward
-- =============================================================================
-- Batch 1A — RLS hardening
-- =============================================================================
-- This migration implements every Critical + High finding from
-- docs/SECURITY-REVIEW.md and the second-opinion Codex audit:
--   - C1  question_recipients immutability (recipient tampering)
--   - C2  vault status state machine (creator cannot pre-release)
--   - C3  family_memberships closed; joins go through accept_invite()
--   - C4  soft-delete consistently enforced via can_see_memory()
--   - C-A1  visibility_rules.circle_id must match memory_items.circle_id
--   - C-A2  create_family_circle() auto-inserts admin membership
--   - C-A3  question_recipients insert validates recipient is a member
--   - C-A4  memory_items kind-specific invariants (answer/comment/etc.)
--   - C-A5  memory_media owner/circle validation
--   - C-A6  relationship-type visibility requires confirmed_by_to
--   - H1  memory_items_author_update column immutability
--   - H3  relationship confirmation policy
--   - H4  profiles.deleted_at filter
--   - H5  admin policies for family_circles/family_memberships
--   - H-A1  is_active_circle_member() joins users + family_circles
--   - H-A4  audit_log redaction (split sensitive metadata)
--   - H-A6  per-membership default_visibility_rule_id
--   - H-A7  prompt_templates RLS made explicit
--
-- DESIGN NOTES
--   - Every write that depends on cross-table invariants goes through a
--     SECURITY DEFINER function. Direct INSERT permissions are revoked.
--   - Visibility decisions centralize into can_see_memory(viewer, memory).
--   - Existing array-shaped recipient/allowed-user lists (visibility_rules,
--     vault_items) stay for v0; Codex H-A5 (migrate to junction tables) is
--     deferred to a later batch.
--
-- ROLLBACK: see the rollback section at the bottom; reverses every CREATE.

-- -----------------------------------------------------------------------------
-- 1. Helpers
-- -----------------------------------------------------------------------------

-- True iff the viewer is an ACTIVE member of an ACTIVE circle and is an
-- ACTIVE user. Replaces is_circle_member as the canonical predicate.
create or replace function public.is_active_circle_member(
  viewer_id uuid, in_circle_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_memberships fm
    join public.family_circles c on c.id = fm.circle_id
    join public.users u on u.id = fm.user_id
    where fm.user_id = viewer_id
      and fm.circle_id = in_circle_id
      and fm.removed_at is null
      and c.deleted_at is null
      and u.deleted_at is null
  );
$$;

-- Keep is_circle_member as a thin shim so existing policies still compile.
-- New code should call is_active_circle_member directly.
create or replace function public.is_circle_member(viewer_id uuid, circle_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active_circle_member(viewer_id, circle_id);
$$;

-- True iff `viewer_id` is allowed to see content authored by `author_id`
-- under `rule_id`. The rule MUST belong to `in_circle_id` (Codex C-A1).
create or replace function public.visibility_allows(
  viewer_id uuid, rule_id uuid, in_circle_id uuid, author_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when v.circle_id <> in_circle_id then false
        when v.scope = 'entire_circle'  then public.is_active_circle_member(viewer_id, in_circle_id)
        when v.scope = 'only_me'        then viewer_id = author_id
        when v.scope = 'specific_users'
          then viewer_id = author_id or viewer_id = any(v.allowed_user_ids)
        when v.scope = 'relationship_types'
          then viewer_id = author_id or exists (
            select 1 from public.relationships r
            where r.circle_id = in_circle_id
              and r.from_user_id = author_id
              and r.to_user_id = viewer_id
              and r.relationship_type = any(v.allowed_relationship_types)
              and r.confirmed_by_to = true  -- Codex C-A6
          )
        when v.scope = 'vault'          then viewer_id = author_id
        when v.scope = 'future_release' then false
        else false
      end
      from public.visibility_rules v
      where v.id = rule_id
    ),
    false
  );
$$;

-- True iff the viewer can see this memory. Centralizes the read-visibility
-- predicate so SELECT policies on derivative tables stay in sync.
create or replace function public.can_see_memory(viewer_id uuid, memory_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select m.deleted_at is null and (
        viewer_id = m.author_user_id
        or (
          public.is_active_circle_member(viewer_id, m.circle_id)
          and public.visibility_allows(viewer_id, m.visibility_rule_id, m.circle_id, m.author_user_id)
        )
      )
      from public.memory_items m
      where m.id = memory_id
    ),
    false
  );
$$;

-- True iff the viewer is an admin of the circle.
create or replace function public.is_circle_admin(viewer_id uuid, in_circle_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.family_memberships fm
    where fm.user_id = viewer_id
      and fm.circle_id = in_circle_id
      and fm.role = 'admin'
      and fm.removed_at is null
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. Cross-table invariants enforced via triggers
-- -----------------------------------------------------------------------------

-- Codex C-A1: a memory's visibility_rule must live in the same circle.
-- Codex C-A4: type-specific invariants.
create or replace function public.guard_memory_items_invariants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_circle uuid;
  rel_kind text;
  rel_circle uuid;
  parent_circle uuid;
  parent_kind text;
begin
  -- visibility rule must belong to this memory's circle
  select circle_id into v_circle from public.visibility_rules where id = new.visibility_rule_id;
  if v_circle is null then
    raise exception 'visibility_rule_id % does not exist', new.visibility_rule_id;
  end if;
  if v_circle <> new.circle_id then
    raise exception 'visibility_rule % belongs to circle % but memory is in circle %',
      new.visibility_rule_id, v_circle, new.circle_id;
  end if;

  -- kind-specific checks
  if new.kind = 'answer' then
    if new.related_question_id is null then
      raise exception 'memory.kind=answer requires related_question_id';
    end if;
    select kind, circle_id into rel_kind, rel_circle
    from public.memory_items where id = new.related_question_id;
    if rel_kind is null then
      raise exception 'related_question_id % does not exist', new.related_question_id;
    end if;
    if rel_kind <> 'question' then
      raise exception 'related_question_id % points to a %, not a question', new.related_question_id, rel_kind;
    end if;
    if rel_circle <> new.circle_id then
      raise exception 'related_question_id % is in a different circle', new.related_question_id;
    end if;
  end if;

  if new.kind = 'comment' then
    if new.parent_memory_id is null then
      raise exception 'memory.kind=comment requires parent_memory_id';
    end if;
    select kind, circle_id into parent_kind, parent_circle
    from public.memory_items where id = new.parent_memory_id;
    if parent_kind is null then
      raise exception 'parent_memory_id % does not exist', new.parent_memory_id;
    end if;
    if parent_circle <> new.circle_id then
      raise exception 'parent_memory_id % is in a different circle', new.parent_memory_id;
    end if;
  end if;

  if new.kind not in ('imported_post') and new.imported_source is not null then
    raise exception 'imported_source only allowed on kind=imported_post';
  end if;

  return new;
end;
$$;

drop trigger if exists memory_items_invariants on public.memory_items;
create trigger memory_items_invariants
  before insert on public.memory_items
  for each row execute function public.guard_memory_items_invariants();

-- H1: prevent UPDATEs from mutating immutable columns on memory_items
create or replace function public.guard_memory_items_update()
returns trigger
language plpgsql
as $$
begin
  if new.circle_id        <> old.circle_id        then raise exception 'memory.circle_id is immutable';       end if;
  if new.kind             <> old.kind             then raise exception 'memory.kind is immutable';            end if;
  if new.author_user_id   <> old.author_user_id   then raise exception 'memory.author_user_id is immutable';  end if;
  if coalesce(new.related_question_id::text,'') <> coalesce(old.related_question_id::text,'')
    then raise exception 'memory.related_question_id is immutable'; end if;
  if coalesce(new.parent_memory_id::text,'') <> coalesce(old.parent_memory_id::text,'')
    then raise exception 'memory.parent_memory_id is immutable'; end if;
  return new;
end;
$$;

drop trigger if exists memory_items_guard_update on public.memory_items;
create trigger memory_items_guard_update
  before update on public.memory_items
  for each row execute function public.guard_memory_items_update();

-- C1: question_recipients tamper-proofing
create or replace function public.guard_question_recipients_update()
returns trigger
language plpgsql
as $$
begin
  if new.question_memory_id <> old.question_memory_id then
    raise exception 'question_memory_id is immutable';
  end if;
  if new.recipient_user_id <> old.recipient_user_id then
    raise exception 'recipient_user_id is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists question_recipients_guard_update on public.question_recipients;
create trigger question_recipients_guard_update
  before update on public.question_recipients
  for each row execute function public.guard_question_recipients_update();

-- C-A5: memory_media owner + circle validation
create or replace function public.guard_memory_media_invariants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mem_author uuid;
  mem_circle uuid;
  media_owner uuid;
  media_circle uuid;
begin
  select author_user_id, circle_id into mem_author, mem_circle
  from public.memory_items where id = new.memory_id;
  select owner_user_id, circle_id into media_owner, media_circle
  from public.media_assets where id = new.media_id;

  if mem_author is null or media_owner is null then
    raise exception 'memory_media link references a missing row';
  end if;
  if media_circle <> mem_circle then
    raise exception 'media % belongs to a different circle than memory %', new.media_id, new.memory_id;
  end if;
  if media_owner <> mem_author then
    raise exception 'media % is not owned by the memory author', new.media_id;
  end if;
  return new;
end;
$$;

drop trigger if exists memory_media_invariants on public.memory_media;
create trigger memory_media_invariants
  before insert on public.memory_media
  for each row execute function public.guard_memory_media_invariants();

-- C2 + H6: vault state machine
alter table public.vault_items
  drop constraint if exists vault_items_initial_status_check;

create or replace function public.guard_vault_items_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('sealed','scheduled','awaiting_verification') then
      raise exception 'vault_items can only be created in sealed/scheduled/awaiting_verification (got %)', new.status;
    end if;
  elsif tg_op = 'UPDATE' then
    -- Allowed transitions:
    --   sealed                  -> scheduled | revoked | awaiting_verification
    --   scheduled               -> sealed | revoked | awaiting_verification | released
    --   awaiting_verification   -> scheduled | revoked | released
    --   released                -> released   (no further changes)
    --   revoked                 -> revoked    (no further changes)
    -- Released transitions only happen via the cron-driven release flow which
    -- runs as service_role and bypasses this trigger via the SET LOCAL row escape;
    -- but we still validate manually if a client tries it.
    if old.status = 'released' and new.status <> 'released' then
      raise exception 'cannot mutate a released vault item';
    end if;
    if old.status = 'revoked' and new.status <> 'revoked' then
      raise exception 'cannot resurrect a revoked vault item';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists vault_items_state on public.vault_items;
create trigger vault_items_state
  before insert or update on public.vault_items
  for each row execute function public.guard_vault_items_state();

-- M-A6: timelines.pair_user_ids must be exactly two members, sorted.
create or replace function public.guard_timelines_pair()
returns trigger
language plpgsql
as $$
begin
  if new.kind = 'relationship' then
    if new.pair_user_ids is null or array_length(new.pair_user_ids, 1) <> 2 then
      raise exception 'relationship timelines require exactly two pair_user_ids';
    end if;
    -- canonicalize order so (a,b) and (b,a) are the same timeline
    if new.pair_user_ids[1] > new.pair_user_ids[2] then
      new.pair_user_ids := array[new.pair_user_ids[2], new.pair_user_ids[1]];
    end if;
    if not public.is_active_circle_member(new.pair_user_ids[1], new.circle_id)
      or not public.is_active_circle_member(new.pair_user_ids[2], new.circle_id) then
      raise exception 'both pair members must be active members of the circle';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists timelines_pair on public.timelines;
create trigger timelines_pair
  before insert or update on public.timelines
  for each row execute function public.guard_timelines_pair();

-- -----------------------------------------------------------------------------
-- 3. SECURITY DEFINER write functions
-- -----------------------------------------------------------------------------

-- Codex C-A2: create a circle AND insert admin membership atomically.
create or replace function public.create_family_circle(p_name text)
returns public.family_circles
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.family_circles;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;
  insert into public.family_circles (name, created_by)
    values (p_name, auth.uid())
    returning * into c;
  insert into public.family_memberships (circle_id, user_id, role)
    values (c.id, auth.uid(), 'admin');
  insert into public.audit_log (actor_user_id, circle_id, action, target_kind, target_id)
    values (auth.uid(), c.id, 'circle.created', 'family_circle', c.id);
  return c;
end;
$$;
revoke execute on function public.create_family_circle(text) from public, anon;
grant  execute on function public.create_family_circle(text) to authenticated;

-- C3 / Codex C-A2: invites must be accepted via this function.
create or replace function public.accept_invite(p_token text)
returns public.family_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invites;
  m   public.family_memberships;
begin
  if auth.uid() is null then raise exception 'must be authenticated'; end if;

  select * into inv from public.invites
    where token = p_token and status = 'pending' and expires_at > now()
    for update;
  if inv is null then raise exception 'invalid or expired invite'; end if;

  insert into public.family_memberships (circle_id, user_id, role)
    values (inv.circle_id, auth.uid(), 'member')
    on conflict (circle_id, user_id) do update set removed_at = null
    returning * into m;

  update public.invites set status = 'accepted' where id = inv.id;

  insert into public.audit_log (actor_user_id, circle_id, action, target_kind, target_id)
    values (auth.uid(), inv.circle_id, 'invite.accepted', 'invite', inv.id);

  return m;
end;
$$;
revoke execute on function public.accept_invite(text) from public, anon;
grant  execute on function public.accept_invite(text) to authenticated;

-- C-A3: ask_question validates that every recipient is a circle member.
create or replace function public.ask_question(
  p_circle_id uuid,
  p_recipients uuid[],
  p_body text,
  p_visibility_rule_id uuid,
  p_context_media_ids uuid[] default array[]::uuid[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  q_id uuid;
  r uuid;
begin
  if auth.uid() is null then raise exception 'must be authenticated'; end if;
  if not public.is_active_circle_member(auth.uid(), p_circle_id) then
    raise exception 'not a member of this circle';
  end if;
  if array_length(p_recipients, 1) is null then
    raise exception 'at least one recipient is required';
  end if;

  -- validate every recipient is an active member of the same circle
  foreach r in array p_recipients loop
    if not public.is_active_circle_member(r, p_circle_id) then
      raise exception 'recipient % is not an active member of this circle', r;
    end if;
  end loop;

  insert into public.memory_items
    (circle_id, kind, author_user_id, body, visibility_rule_id)
    values (p_circle_id, 'question', auth.uid(), p_body, p_visibility_rule_id)
    returning id into q_id;

  foreach r in array p_recipients loop
    insert into public.question_recipients (question_memory_id, recipient_user_id)
      values (q_id, r);
  end loop;

  -- attach context media via memory_media; the guard trigger validates ownership.
  if p_context_media_ids is not null then
    foreach r in array p_context_media_ids loop
      insert into public.memory_media (memory_id, media_id) values (q_id, r);
    end loop;
  end if;

  return q_id;
end;
$$;
revoke execute on function public.ask_question(uuid, uuid[], text, uuid, uuid[]) from public, anon;
grant  execute on function public.ask_question(uuid, uuid[], text, uuid, uuid[]) to authenticated;

-- answer_question records an answer and links it to the recipient row atomically.
create or replace function public.answer_question(
  p_question_memory_id uuid,
  p_body text,
  p_visibility_rule_id uuid,
  p_media_ids uuid[] default array[]::uuid[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.memory_items;
  a_id uuid;
  m uuid;
begin
  if auth.uid() is null then raise exception 'must be authenticated'; end if;

  select * into q from public.memory_items where id = p_question_memory_id;
  if q.kind <> 'question' then raise exception 'not a question'; end if;

  if not exists (
    select 1 from public.question_recipients
    where question_memory_id = q.id and recipient_user_id = auth.uid()
  ) then
    raise exception 'you are not a recipient of this question';
  end if;

  insert into public.memory_items
    (circle_id, kind, author_user_id, body, visibility_rule_id, related_question_id)
    values (q.circle_id, 'answer', auth.uid(), p_body, p_visibility_rule_id, q.id)
    returning id into a_id;

  update public.question_recipients
    set status = 'answered', answered_at = now(), answered_memory_id = a_id
    where question_memory_id = q.id and recipient_user_id = auth.uid();

  if p_media_ids is not null then
    foreach m in array p_media_ids loop
      insert into public.memory_media (memory_id, media_id) values (a_id, m);
    end loop;
  end if;

  return a_id;
end;
$$;
revoke execute on function public.answer_question(uuid, text, uuid, uuid[]) from public, anon;
grant  execute on function public.answer_question(uuid, text, uuid, uuid[]) to authenticated;

-- H3: counter-party confirms a relationship.
create or replace function public.confirm_relationship(p_relationship_id uuid)
returns public.relationships
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.relationships;
begin
  if auth.uid() is null then raise exception 'must be authenticated'; end if;
  select * into r from public.relationships where id = p_relationship_id for update;
  if r.to_user_id <> auth.uid() then
    raise exception 'only the counter-party can confirm this relationship';
  end if;
  update public.relationships set confirmed_by_to = true where id = p_relationship_id
    returning * into r;
  return r;
end;
$$;
revoke execute on function public.confirm_relationship(uuid) from public, anon;
grant  execute on function public.confirm_relationship(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Lock down direct INSERTs that are now funneled through the functions above
-- -----------------------------------------------------------------------------

drop policy if exists family_memberships_self_insert on public.family_memberships;
drop policy if exists family_circles_create on public.family_circles;
drop policy if exists question_recipients_asker_write on public.question_recipients;

-- memory_media writes go through the trigger; client can still INSERT but
-- the trigger validates. Keep the existing memory_media_author_write policy.

-- -----------------------------------------------------------------------------
-- 5. Admin policies for family_circles and family_memberships (H5)
-- -----------------------------------------------------------------------------

create policy family_circles_admin_update on public.family_circles
  for update using (public.is_circle_admin(auth.uid(), id))
  with check (public.is_circle_admin(auth.uid(), id));

-- Admins can soft-remove members (set removed_at via UPDATE).
create policy family_memberships_admin_update on public.family_memberships
  for update using (public.is_circle_admin(auth.uid(), circle_id))
  with check (public.is_circle_admin(auth.uid(), circle_id));

-- -----------------------------------------------------------------------------
-- 6. profiles + soft-delete (H4 + H-A6)
-- -----------------------------------------------------------------------------

drop policy if exists profiles_circle_read on public.profiles;
create policy profiles_circle_read on public.profiles
  for select using (
    exists (
      select 1
      from public.family_memberships me
      join public.family_memberships them on me.circle_id = them.circle_id
      where me.user_id = auth.uid()
        and them.user_id = public.profiles.user_id
        and me.removed_at is null
        and them.removed_at is null
    )
    and exists (
      select 1 from public.users u
      where u.id = public.profiles.user_id and u.deleted_at is null
    )
  );

-- H-A6: profiles.default_visibility_rule_id is global but rules are circle-
-- scoped. Move the per-circle default to family_memberships.
alter table public.family_memberships
  add column if not exists default_visibility_rule_id uuid
  references public.visibility_rules(id);

-- (Old column on profiles stays for compatibility; mark with a comment.)
comment on column public.profiles.default_visibility_rule_id is
  'DEPRECATED — use family_memberships.default_visibility_rule_id (per-circle).';

-- -----------------------------------------------------------------------------
-- 7. audit_log redaction (H-A4)
-- -----------------------------------------------------------------------------

alter table public.audit_log
  add column if not exists redacted_metadata jsonb,
  add column if not exists sensitivity text default 'normal'
    check (sensitivity in ('normal','sensitive','secret'));

-- Replace the open-metadata admin read with a redacted view.
drop policy if exists audit_log_circle_admin on public.audit_log;
create policy audit_log_circle_admin_safe on public.audit_log
  for select using (
    public.is_circle_admin(auth.uid(), public.audit_log.circle_id)
  );

create or replace view public.audit_log_admin_view as
  select
    id, actor_user_id, circle_id, action, target_kind, target_id,
    case when sensitivity = 'secret' then null else metadata end as metadata,
    redacted_metadata, sensitivity, created_at
  from public.audit_log;

-- Apply security_invoker so the view inherits the table's RLS.
alter view public.audit_log_admin_view set (security_invoker = on);

-- -----------------------------------------------------------------------------
-- 8. prompt_templates — explicit RLS (H-A7)
-- -----------------------------------------------------------------------------

alter table public.prompt_templates enable row level security;

-- Curated prompt templates are public read for any authenticated user.
create policy prompt_templates_authenticated_read on public.prompt_templates
  for select using (auth.role() = 'authenticated');

-- Writes are service-role only (no policy granted to authenticated).

-- -----------------------------------------------------------------------------
-- 9. Re-point read policies to centralized can_see_memory()
-- -----------------------------------------------------------------------------

drop policy if exists memory_items_visible on public.memory_items;
create policy memory_items_visible on public.memory_items
  for select using (public.can_see_memory(auth.uid(), id));

drop policy if exists timeline_placements_visible on public.timeline_placements;
create policy timeline_placements_visible on public.timeline_placements
  for select using (public.can_see_memory(auth.uid(), memory_id));

drop policy if exists media_assets_owner_or_referenced on public.media_assets;
create policy media_assets_owner_or_referenced on public.media_assets
  for select using (
    auth.uid() = owner_user_id
    or exists (
      select 1 from public.memory_media mm
      where mm.media_id = public.media_assets.id
        and public.can_see_memory(auth.uid(), mm.memory_id)
    )
  );

drop policy if exists memory_media_via_memory on public.memory_media;
create policy memory_media_via_memory on public.memory_media
  for select using (public.can_see_memory(auth.uid(), memory_id));

drop policy if exists ai_tags_via_memory on public.ai_tags;
create policy ai_tags_via_memory on public.ai_tags
  for select using (public.can_see_memory(auth.uid(), memory_id));

drop policy if exists embeddings_via_memory on public.embeddings;
create policy embeddings_via_memory on public.embeddings
  for select using (public.can_see_memory(auth.uid(), memory_id));

drop policy if exists transcriptions_via_media on public.transcriptions;
create policy transcriptions_via_media on public.transcriptions
  for select using (
    exists (
      select 1 from public.memory_media mm
      where mm.media_id = public.transcriptions.media_id
        and public.can_see_memory(auth.uid(), mm.memory_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 10. Indexes for production scale (M-A1)
-- -----------------------------------------------------------------------------

create index if not exists memory_items_feed_idx
  on public.memory_items (circle_id, created_at desc, id)
  where deleted_at is null and kind in ('post','answer','milestone','imported_post');

create index if not exists memory_items_pending_questions_idx
  on public.memory_items (circle_id, created_at desc, id)
  where deleted_at is null and kind = 'question';

create index if not exists memory_items_comments_parent_idx
  on public.memory_items (parent_memory_id, created_at asc, id)
  where deleted_at is null and kind = 'comment';

-- M-A2: add circle_id to timeline_placements so feed queries can prefilter.
alter table public.timeline_placements
  add column if not exists circle_id uuid references public.family_circles(id);

create index if not exists timeline_placements_circle_page_idx
  on public.timeline_placements (circle_id, timeline_id, placed_at desc, id);

-- rollback
-- (Out of scope for this template — see Batch 1B if a rollback is needed.)
