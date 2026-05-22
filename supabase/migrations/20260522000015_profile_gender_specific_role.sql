-- forward
-- =============================================================================
-- profiles: add gender column + expand role vocabulary
-- =============================================================================
-- Why: the Questions Engine personalizes prompts based on who the user is in
-- their family. "Mom, tell me about your childhood" reads completely
-- differently from "Grandma, tell me about your childhood." The original role
-- enum (elder/middle/child) was too coarse — it can't tell a parent from a
-- grandparent, and it doesn't capture gender at all.
--
-- This migration:
--   1. Adds a nullable `gender` column ('female'|'male'|'nonbinary'|'prefer_not'
--      or null for unspecified — text column, validated at the app layer).
--   2. Documents the expanded role vocabulary. The column was already text
--      with no CHECK constraint, so no DDL is required for the new values:
--        parent, grandparent, child, grandchild, middle
--      The legacy values ('elder', 'child', 'middle') remain valid for
--      backward compatibility with existing rows.
--
-- App-layer mapping (see branchStore.ts dbRoleToClient):
--   parent, grandparent, elder              → answer mode (storyteller)
--   child, grandchild                       → ask mode (asker)
--   middle                                  → middle (defaults to ask)
--
-- ROLLBACK: see bottom of file.

alter table public.profiles
  add column if not exists gender text;

comment on column public.profiles.gender is
  'User-declared gender for prompt personalization. Expected values: ''female'', ''male'', ''nonbinary'', ''prefer_not'', or NULL. Validated at the app layer; no CHECK so future categories don''t require a migration.';

comment on column public.profiles.role is
  'Generational role within the family. Expected values: ''parent'', ''grandparent'', ''child'', ''grandchild'', ''middle''. Legacy: ''elder'' is treated as ''parent''-or-''grandparent'' (unspecified). Drives Ask vs Answer mode and personalized prompts.';

-- rollback
-- alter table public.profiles drop column if exists gender;
