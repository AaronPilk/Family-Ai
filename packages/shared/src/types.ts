/**
 * Domain types — mirror packages/db/migrations. Source of truth is SQL; this is a
 * convenience layer for the client. Regenerate `database.types.ts` from Supabase
 * via `pnpm db:types` once the local DB is up.
 */

export type RelationshipType =
  | 'parent'
  | 'child'
  | 'grandparent'
  | 'grandchild'
  | 'sibling'
  | 'spouse'
  | 'aunt_uncle'
  | 'niece_nephew'
  | 'cousin'
  | 'chosen_family'
  | 'custom';

export type MemoryKind =
  | 'question'
  | 'answer'
  | 'post'
  | 'comment'
  | 'vault_message'
  | 'imported_post'
  | 'milestone';

export type MediaKind = 'image' | 'video' | 'audio' | 'document' | 'screenshot';

export type TimelineKind = 'personal' | 'relationship' | 'family' | 'topic';

export type VisibilityScope =
  | 'only_me'
  | 'specific_users'
  | 'relationship_types'
  | 'entire_circle'
  | 'vault'
  | 'future_release';

export type MembershipRole = 'admin' | 'member' | 'co_pilot';

export type VaultStatus = 'sealed' | 'scheduled' | 'released' | 'revoked' | 'awaiting_verification';

export type VaultReleaseRule =
  | { type: 'on_date'; date: string /* YYYY-MM-DD */ }
  | { type: 'on_birthday'; user_id: string; age: number }
  | { type: 'on_age'; user_id: string; age: number }
  | { type: 'on_milestone'; user_id: string; milestone: 'first_child' | 'marriage' | 'graduation' }
  | { type: 'after_death'; verifier_user_ids: string[] }
  | { type: 'manual' };

export interface VisibilityRule {
  id: string;
  circle_id: string;
  scope: VisibilityScope;
  allowed_user_ids: string[];
  allowed_relationship_types: RelationshipType[];
  created_by: string;
  created_at: string;
}

export interface MemoryItem {
  id: string;
  circle_id: string;
  kind: MemoryKind;
  author_user_id: string;
  body: string | null;
  context_note: string | null;
  related_question_id: string | null;
  parent_memory_id: string | null;
  imported_source: { platform: string; url: string; screenshot_media_id?: string } | null;
  visibility_rule_id: string;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
