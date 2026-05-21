-- =============================================================================
-- C4 — soft-deleted memories don't leak via dependent tables
-- =============================================================================
-- can_see_memory() centralizes the visibility predicate and includes the
-- deleted_at IS NULL check. SELECT policies on timeline_placements,
-- transcriptions, ai_tags, embeddings, memory_media, and media_assets all
-- delegate to can_see_memory(). Soft-deleting a memory should hide every
-- dependent row from authenticated reads.
--
-- Reference: docs/SECURITY-REVIEW.md C4
--           packages/db/migrations/20260101000012_rls_hardening.sql:110-132, 657-720

begin;
select plan(5);

-- ---- Setup ------------------------------------------------------------------
do $$
declare
  author_uid uuid := tests.fixture_user('author@test.local', 'Author');
  cid uuid := tests.fixture_circle('Soft-delete test', author_uid);
  visibility_id uuid;
  memory_id uuid := uuid_generate_v4();
  media_id uuid := uuid_generate_v4();
begin
  insert into public.visibility_rules (id, circle_id, scope, allowed_user_ids, allowed_relationship_types, created_by)
  values (uuid_generate_v4(), cid, 'entire_circle', '{}', '{}', author_uid)
  returning id into visibility_id;

  -- Author posts a memory.
  insert into public.memory_items (id, circle_id, kind, author_user_id, body, visibility_rule_id)
  values (memory_id, cid, 'post', author_uid, 'A memory about lasagna', visibility_id);

  -- A timeline placement points at it.
  insert into public.timeline_placements (id, memory_id, timeline_kind, timeline_key)
  values (uuid_generate_v4(), memory_id, 'topic', 'food');

  -- A media asset is owned by the author and referenced by the memory.
  insert into public.media_assets (id, owner_user_id, storage_path, kind, created_at)
  values (media_id, author_uid, 'photos/' || media_id || '.jpg', 'image', now());

  insert into public.memory_media (memory_id, media_id, position)
  values (memory_id, media_id, 0);

  -- A transcription exists for the media.
  insert into public.transcriptions (id, media_id, body, language, created_at)
  values (uuid_generate_v4(), media_id, 'transcript body', 'en', now());

  -- An AI tag exists for the memory.
  insert into public.ai_tags (id, memory_id, tag, confidence, created_at)
  values (uuid_generate_v4(), memory_id, 'food', 0.92, now());

  perform set_config('test.author_uid', author_uid::text, true);
  perform set_config('test.cid', cid::text, true);
  perform set_config('test.memory_id', memory_id::text, true);
  perform set_config('test.media_id', media_id::text, true);
end$$;

-- Sanity check 1: before deletion, author sees the memory.
select results_eq(
  format(
    $$do $body$
      begin
        perform tests.set_role_authed(%L::uuid);
      end;
      $body$;
      select count(*)::int from public.memory_items where id = %L::uuid$$,
    current_setting('test.author_uid'),
    current_setting('test.memory_id')
  ),
  $$values (1)$$,
  'C4.0 — author can see memory before soft-delete (sanity)'
);

-- Now soft-delete the memory (acting as the author).
do $$
begin
  perform tests.set_role_authed(current_setting('test.author_uid')::uuid);
  update public.memory_items set deleted_at = now() where id = current_setting('test.memory_id')::uuid;
  perform tests.reset_role();
end$$;

-- 2. After soft-delete, the memory itself is invisible.
select results_eq(
  format(
    $$do $body$
      begin
        perform tests.set_role_authed(%L::uuid);
      end;
      $body$;
      select count(*)::int from public.memory_items where id = %L::uuid$$,
    current_setting('test.author_uid'),
    current_setting('test.memory_id')
  ),
  $$values (0)$$,
  'C4.1 — soft-deleted memory no longer visible'
);

-- 3. timeline_placements pointing at it are invisible.
select results_eq(
  format(
    $$do $body$
      begin
        perform tests.set_role_authed(%L::uuid);
      end;
      $body$;
      select count(*)::int from public.timeline_placements where memory_id = %L::uuid$$,
    current_setting('test.author_uid'),
    current_setting('test.memory_id')
  ),
  $$values (0)$$,
  'C4.2 — placements of soft-deleted memory are hidden'
);

-- 4. transcriptions of dependent media are invisible.
select results_eq(
  format(
    $$do $body$
      begin
        perform tests.set_role_authed(%L::uuid);
      end;
      $body$;
      select count(*)::int from public.transcriptions where media_id = %L::uuid$$,
    current_setting('test.author_uid'),
    current_setting('test.media_id')
  ),
  $$values (0)$$,
  'C4.3 — transcriptions referring to soft-deleted memory are hidden'
);

-- 5. ai_tags for the memory are invisible.
select results_eq(
  format(
    $$do $body$
      begin
        perform tests.set_role_authed(%L::uuid);
      end;
      $body$;
      select count(*)::int from public.ai_tags where memory_id = %L::uuid$$,
    current_setting('test.author_uid'),
    current_setting('test.memory_id')
  ),
  $$values (0)$$,
  'C4.4 — ai_tags on soft-deleted memory are hidden'
);

select * from finish();
rollback;
