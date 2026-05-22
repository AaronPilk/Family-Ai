-- =============================================================================
-- Daily Questions / Answering surface — RPC + visibility-rule bootstrap
-- =============================================================================
-- The Family Memory side lets parents/grandparents answer one curated question
-- at a time from `prompt_templates`. The existing memory_items invariants
-- require an `answer` row to point at a `question` memory_item in the same
-- circle. Templates aren't memory_items, so we need to materialise a wrapper
-- question on first answer.
--
-- This migration adds:
--   1. ensure_default_visibility_rule(p_circle_id) — idempotent helper that
--      returns the circle's "entire_circle" rule, creating it if absent.
--      Needed because handle_new_auth_user doesn't seed one, and memory_items
--      has a NOT NULL FK on visibility_rule_id.
--   2. answer_prompt_template(p_template_id, p_body) — single-shot RPC that:
--        a. resolves the caller's primary family_circle
--        b. ensures a default visibility rule
--        c. inserts a `question` memory_item carrying the template body
--           (meta.template_id = p_template_id; meta.kind = 'prompt_question')
--        d. inserts an `answer` linked to that question
--        e. returns (answer_id, question_id)
--      This keeps the client one round-trip per answer and never trusts the
--      client to set author_user_id or visibility_rule_id.
--
-- RLS sanity: the existing policies on memory_items already permit
--   - SELECT own rows  (auth.uid() = author_user_id)
--   - SELECT family-circle rows  (is_circle_member + visibility_allows)
--   - INSERT only with auth.uid() = author_user_id
-- so this migration is additive — no policy edits needed.
--
-- ROLLBACK at bottom.

-- 1. ensure_default_visibility_rule -------------------------------------------

create or replace function public.ensure_default_visibility_rule(p_circle_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'must be authenticated'; end if;
  if not public.is_circle_member(auth.uid(), p_circle_id) then
    raise exception 'not a member of this circle';
  end if;

  select id into v_id
  from public.visibility_rules
  where circle_id = p_circle_id and scope = 'entire_circle'
  order by created_at asc
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.visibility_rules (circle_id, scope, created_by)
  values (p_circle_id, 'entire_circle', auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.ensure_default_visibility_rule(uuid) from public, anon;
grant  execute on function public.ensure_default_visibility_rule(uuid) to authenticated;

-- 2. answer_prompt_template ----------------------------------------------------

create or replace function public.answer_prompt_template(
  p_template_id uuid,
  p_body text
) returns table(answer_id uuid, question_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_circle_id uuid;
  v_template_body text;
  v_rule_id uuid;
  v_question_id uuid;
  v_answer_id uuid;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;

  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'answer body is required';
  end if;

  -- Resolve the caller's primary circle. handle_new_auth_user creates one
  -- per user; if they're in multiple, pick the oldest membership.
  select fm.circle_id into v_circle_id
  from public.family_memberships fm
  where fm.user_id = v_uid and fm.removed_at is null
  order by fm.created_at asc
  limit 1;

  if v_circle_id is null then
    raise exception 'no family circle for user';
  end if;

  -- Resolve the template.
  select body into v_template_body
  from public.prompt_templates
  where id = p_template_id;

  if v_template_body is null then
    raise exception 'prompt template % not found', p_template_id;
  end if;

  -- Ensure a visibility rule exists.
  v_rule_id := public.ensure_default_visibility_rule(v_circle_id);

  -- Materialise the question (self-asked).
  insert into public.memory_items
    (circle_id, kind, author_user_id, body, visibility_rule_id, meta)
  values (
    v_circle_id, 'question', v_uid, v_template_body, v_rule_id,
    jsonb_build_object('template_id', p_template_id, 'source', 'prompt_template')
  )
  returning id into v_question_id;

  -- Insert the answer.
  insert into public.memory_items
    (circle_id, kind, author_user_id, body, visibility_rule_id, related_question_id)
  values (v_circle_id, 'answer', v_uid, p_body, v_rule_id, v_question_id)
  returning id into v_answer_id;

  return query select v_answer_id, v_question_id;
end;
$$;

revoke execute on function public.answer_prompt_template(uuid, text) from public, anon;
grant  execute on function public.answer_prompt_template(uuid, text) to authenticated;

-- rollback
-- drop function if exists public.answer_prompt_template(uuid, text);
-- drop function if exists public.ensure_default_visibility_rule(uuid);
