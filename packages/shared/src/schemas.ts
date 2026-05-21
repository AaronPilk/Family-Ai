import { z } from 'zod';
import { TOPIC_TAXONOMY } from './taxonomy';

export const relationshipTypeSchema = z.enum([
  'parent',
  'child',
  'grandparent',
  'grandchild',
  'sibling',
  'spouse',
  'aunt_uncle',
  'niece_nephew',
  'cousin',
  'chosen_family',
  'custom',
]);

export const memoryKindSchema = z.enum([
  'question',
  'answer',
  'post',
  'comment',
  'vault_message',
  'imported_post',
  'milestone',
]);

export const visibilityScopeSchema = z.enum([
  'only_me',
  'specific_users',
  'relationship_types',
  'entire_circle',
  'vault',
  'future_release',
]);

export const visibilityRuleInputSchema = z.object({
  scope: visibilityScopeSchema,
  allowed_user_ids: z.array(z.string().uuid()).default([]),
  allowed_relationship_types: z.array(relationshipTypeSchema).default([]),
});

export const askQuestionInputSchema = z.object({
  circle_id: z.string().uuid(),
  recipient_user_ids: z.array(z.string().uuid()).min(1),
  body: z.string().min(1).max(2000),
  context_media_ids: z.array(z.string().uuid()).default([]),
  visibility: visibilityRuleInputSchema,
});

export const answerQuestionInputSchema = z.object({
  question_memory_id: z.string().uuid(),
  body: z.string().max(8000).optional(),
  media_ids: z.array(z.string().uuid()).default([]),
  visibility: visibilityRuleInputSchema.optional(),
});

export const vaultReleaseRuleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('on_date'), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({
    type: z.literal('on_birthday'),
    user_id: z.string().uuid(),
    age: z.number().int().min(1).max(150),
  }),
  z.object({
    type: z.literal('on_age'),
    user_id: z.string().uuid(),
    age: z.number().int().min(1).max(150),
  }),
  z.object({
    type: z.literal('on_milestone'),
    user_id: z.string().uuid(),
    milestone: z.enum(['first_child', 'marriage', 'graduation']),
  }),
  z.object({
    type: z.literal('after_death'),
    verifier_user_ids: z.array(z.string().uuid()).min(1),
  }),
  z.object({ type: z.literal('manual') }),
]);

export const topicSlugSchema = z.enum(TOPIC_TAXONOMY);
