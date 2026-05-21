-- =============================================================================
-- C2 — vault items cannot be inserted as released
-- =============================================================================
-- The hardening migration installs guard_vault_items_state which enforces:
--   * INSERT may only land statuses in ('sealed','scheduled','awaiting_verification','revoked')
--   * release transitions ('released') must come from service_role via
--     transition_vault_item(), never directly from authenticated clients.
--
-- Reference: docs/SECURITY-REVIEW.md C2
--           packages/db/migrations/20260101000012_rls_hardening.sql:303-339

begin;
select plan(3);

-- ---- Setup ------------------------------------------------------------------
do $$
declare
  creator_uid uuid := tests.fixture_user('creator@test.local', 'Creator');
  cid uuid := tests.fixture_circle('Vault test', creator_uid);
  visibility_id uuid;
begin
  insert into public.visibility_rules (id, circle_id, scope, allowed_user_ids, allowed_relationship_types, created_by)
  values (uuid_generate_v4(), cid, 'vault', '{}', '{}', creator_uid)
  returning id into visibility_id;

  perform set_config('test.creator_uid', creator_uid::text, true);
  perform set_config('test.cid', cid::text, true);
  perform set_config('test.vis_id', visibility_id::text, true);
end$$;

-- 1. Direct INSERT with status='released' is rejected.
select throws_ok(
  format(
    $$insert into public.vault_items (id, circle_id, creator_user_id, title, status, visibility_rule_id, release_rule)
      values (%L, %L, %L, 'Early release attempt', 'released', %L, '{"type":"manual"}'::jsonb)$$,
    uuid_generate_v4(),
    current_setting('test.cid'),
    current_setting('test.creator_uid'),
    current_setting('test.vis_id')
  ),
  null,
  'C2.1 — direct insert with status=released must be blocked'
);

-- 2. Insert with status='sealed' is allowed (the legitimate creation path).
select lives_ok(
  format(
    $$insert into public.vault_items (id, circle_id, creator_user_id, title, status, visibility_rule_id, release_rule)
      values (%L, %L, %L, 'Letter to my future self', 'sealed', %L, '{"type":"on_date","date":"2030-01-01"}'::jsonb)$$,
    uuid_generate_v4(),
    current_setting('test.cid'),
    current_setting('test.creator_uid'),
    current_setting('test.vis_id')
  ),
  'C2.2 — sealed insert is permitted'
);

-- 3. As authenticated, the creator cannot flip status to released directly.
-- (RLS denies UPDATE for non-service_role; the guard would also reject it.)
do $$
declare
  vault_id uuid := uuid_generate_v4();
begin
  insert into public.vault_items (id, circle_id, creator_user_id, title, status, visibility_rule_id, release_rule)
  values (vault_id, current_setting('test.cid')::uuid, current_setting('test.creator_uid')::uuid,
          'Sealed-for-now', 'sealed', current_setting('test.vis_id')::uuid, '{"type":"manual"}'::jsonb);
  perform set_config('test.vault_id', vault_id::text, true);
end$$;

select throws_ok(
  format(
    $$do $body$
      begin
        perform tests.set_role_authed(%L::uuid);
        update public.vault_items set status = 'released' where id = %L;
        perform tests.reset_role();
      end;
      $body$;$$,
    current_setting('test.creator_uid'),
    current_setting('test.vault_id')
  ),
  null,
  'C2.3 — creator cannot self-release as authenticated'
);

select * from finish();
rollback;
