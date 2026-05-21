-- =============================================================================
-- C1 — question_recipients tamper protection
-- =============================================================================
-- The hardening migration installs a BEFORE UPDATE trigger on
-- question_recipients that forbids changes to question_memory_id and
-- recipient_user_id. This file proves the trigger fires for both fields,
-- and that legitimate status updates still pass through.
--
-- Reference: docs/SECURITY-REVIEW.md C1
--           packages/db/migrations/20260101000012_rls_hardening.sql:243-261

begin;
select plan(4);

-- ---- Setup ------------------------------------------------------------------
-- Two users: asker (the parent) and recipient (the child).
do $$
declare
  asker_uid uuid := tests.fixture_user('asker@test.local', 'Mom');
  recipient_uid uuid := tests.fixture_user('recipient@test.local', 'Aaron');
  cid uuid := tests.fixture_circle('Pilks (test)', asker_uid);
  question_id uuid;
  other_question_id uuid;
  other_user_uid uuid := tests.fixture_user('intruder@test.local', 'Intruder');
  recipient_row_id uuid;
  visibility_id uuid;
begin
  perform tests.fixture_member(cid, recipient_uid);

  -- Need a visibility rule for memory_items inserts.
  insert into public.visibility_rules (id, circle_id, scope, allowed_user_ids, allowed_relationship_types, created_by)
  values (uuid_generate_v4(), cid, 'entire_circle', '{}', '{}', asker_uid)
  returning id into visibility_id;

  -- Two question memories — Asker asks the Recipient something, plus an
  -- unrelated second question to test re-targeting.
  insert into public.memory_items (id, circle_id, kind, author_user_id, body, visibility_rule_id)
  values (uuid_generate_v4(), cid, 'question', asker_uid, 'What was your favorite snack?', visibility_id)
  returning id into question_id;

  insert into public.memory_items (id, circle_id, kind, author_user_id, body, visibility_rule_id)
  values (uuid_generate_v4(), cid, 'question', asker_uid, 'Different question', visibility_id)
  returning id into other_question_id;

  -- The recipient row that ties recipient_uid to the first question.
  insert into public.question_recipients (id, question_memory_id, recipient_user_id, status)
  values (uuid_generate_v4(), question_id, recipient_uid, 'pending')
  returning id into recipient_row_id;

  -- Stash for the asserts.
  perform set_config('test.recipient_row_id', recipient_row_id::text, true);
  perform set_config('test.question_id', question_id::text, true);
  perform set_config('test.other_question_id', other_question_id::text, true);
  perform set_config('test.recipient_uid', recipient_uid::text, true);
  perform set_config('test.other_user_uid', other_user_uid::text, true);
end$$;

-- ---- Assertions -------------------------------------------------------------

-- 1. Attempting to re-target the question_memory_id raises.
select throws_ok(
  format(
    'update public.question_recipients set question_memory_id = %L where id = %L',
    current_setting('test.other_question_id'),
    current_setting('test.recipient_row_id')
  ),
  'question_memory_id is immutable',
  'C1.1 — recipient cannot change question_memory_id'
);

-- 2. Attempting to change recipient_user_id raises.
select throws_ok(
  format(
    'update public.question_recipients set recipient_user_id = %L where id = %L',
    current_setting('test.other_user_uid'),
    current_setting('test.recipient_row_id')
  ),
  'recipient_user_id is immutable',
  'C1.2 — recipient_user_id is immutable'
);

-- 3. Legitimate status update is allowed (status → answered, no immutable fields).
select lives_ok(
  format(
    'update public.question_recipients set status = %L where id = %L',
    'answered',
    current_setting('test.recipient_row_id')
  ),
  'C1.3 — status changes still permitted'
);

-- 4. Cleanup sanity: the row still exists and has the new status.
select results_eq(
  format(
    'select status from public.question_recipients where id = %L',
    current_setting('test.recipient_row_id')
  ),
  $$values ('answered'::text)$$,
  'C1.4 — legitimate status update persisted'
);

select * from finish();
rollback;
