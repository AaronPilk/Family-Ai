-- =============================================================================
-- C3 — joining a family circle requires an accepted invite
-- =============================================================================
-- The hardening migration revokes direct INSERT on family_memberships for
-- the authenticated role and replaces it with accept_invite(token), which is
-- SECURITY DEFINER and validates the invite token before inserting.
--
-- Reference: docs/SECURITY-REVIEW.md C3
--           packages/db/migrations/20260101000012_rls_hardening.sql:399-432

begin;
select plan(4);

-- ---- Setup ------------------------------------------------------------------
do $$
declare
  admin_uid uuid := tests.fixture_user('admin@test.local', 'Admin');
  outsider_uid uuid := tests.fixture_user('outsider@test.local', 'Outsider');
  cid uuid := tests.fixture_circle('Closed circle', admin_uid);
  good_token text := 'valid-invite-' || substr(md5(random()::text), 1, 12);
  bad_token text := 'expired-invite-' || substr(md5(random()::text), 1, 12);
begin
  -- One valid invite, one already-expired invite.
  insert into public.invites (id, circle_id, token, status, expires_at, created_by)
  values
    (uuid_generate_v4(), cid, good_token, 'pending', now() + interval '7 days', admin_uid),
    (uuid_generate_v4(), cid, bad_token, 'pending', now() - interval '1 day', admin_uid);

  perform set_config('test.admin_uid', admin_uid::text, true);
  perform set_config('test.outsider_uid', outsider_uid::text, true);
  perform set_config('test.cid', cid::text, true);
  perform set_config('test.good_token', good_token, true);
  perform set_config('test.bad_token', bad_token, true);
end$$;

-- 1. Direct INSERT into family_memberships as authenticated outsider must fail
-- (RLS denies; the policy was dropped in the hardening migration).
select throws_ok(
  format(
    $$do $body$
      begin
        perform tests.set_role_authed(%L::uuid);
        insert into public.family_memberships (circle_id, user_id, role)
        values (%L::uuid, %L::uuid, 'member');
        perform tests.reset_role();
      end;
      $body$;$$,
    current_setting('test.outsider_uid'),
    current_setting('test.cid'),
    current_setting('test.outsider_uid')
  ),
  null,
  'C3.1 — outsider cannot directly insert a membership row'
);

-- 2. accept_invite() with a valid token succeeds and inserts the membership.
select lives_ok(
  format(
    $$do $body$
      begin
        perform tests.set_role_authed(%L::uuid);
        perform public.accept_invite(%L);
        perform tests.reset_role();
      end;
      $body$;$$,
    current_setting('test.outsider_uid'),
    current_setting('test.good_token')
  ),
  'C3.2 — accept_invite with valid token succeeds'
);

-- 3. Verify the membership row exists after the legit path.
select results_eq(
  format(
    $$select count(*)::int from public.family_memberships
      where circle_id = %L and user_id = %L$$,
    current_setting('test.cid'),
    current_setting('test.outsider_uid')
  ),
  $$values (1)$$,
  'C3.3 — membership was actually created via accept_invite'
);

-- 4. accept_invite() with an expired token raises.
select throws_ok(
  format(
    $$do $body$
      begin
        perform tests.set_role_authed(%L::uuid);
        perform public.accept_invite(%L);
        perform tests.reset_role();
      end;
      $body$;$$,
    current_setting('test.outsider_uid'),
    current_setting('test.bad_token')
  ),
  null,
  'C3.4 — accept_invite with expired token must fail'
);

select * from finish();
rollback;
