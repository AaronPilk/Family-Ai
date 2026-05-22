/**
 * Supabase data layer for the Family Memory side — answering curated questions
 * (prompt_templates) and reading the resulting personal timeline of answers.
 *
 * The schema requires every `kind='answer'` memory_item to point at a
 * `kind='question'` memory_item in the same circle. Templates aren't memories,
 * so when a user answers a template the RPC `answer_prompt_template` wraps
 * the template body in a self-asked question and links the answer to it in
 * one shot. See migration 20260522000005_memory_items_rls_patch.sql.
 *
 * All writes flow through the anon-key supabase client + RLS. The RPC is
 * security-definer so the client never needs to set author_user_id, circle_id,
 * or visibility_rule_id.
 */

import { supabase } from './supabase';

// ---- Types ------------------------------------------------------------------

export interface PromptTemplate {
  id: string;
  category: string;
  body: string;
  weight: number;
}

export interface MemoryAnswer {
  id: string;
  body: string;
  createdAt: string;
  authorUserId: string;
  /** The question this answer responds to. */
  question: {
    id: string;
    body: string;
  } | null;
}

export class SupabaseMemoryError extends Error {
  cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'SupabaseMemoryError';
    this.cause = cause;
  }
}

// ---- Fallback questions when no templates are seeded ------------------------
// Five gentle defaults so testers (especially Mom) never see a dead screen
// even if seeds haven't run on a given environment.
export const FALLBACK_QUESTIONS: PromptTemplate[] = [
  {
    id: 'fallback-1',
    category: 'childhood',
    body: "What's the earliest memory you have?",
    weight: 5,
  },
  {
    id: 'fallback-2',
    category: 'love',
    body: 'How did you meet your spouse?',
    weight: 5,
  },
  {
    id: 'fallback-3',
    category: 'work',
    body: 'What was your favorite job?',
    weight: 4,
  },
  {
    id: 'fallback-4',
    category: 'senses',
    body: "What's a smell that takes you back?",
    weight: 4,
  },
  {
    id: 'fallback-5',
    category: 'family',
    body: 'Tell us about your siblings.',
    weight: 4,
  },
];

export function isFallbackQuestion(id: string): boolean {
  return id.startsWith('fallback-');
}

// ---- Internal helpers -------------------------------------------------------

/**
 * Returns the set of prompt_template ids the user has already answered.
 * An answer links to its question via related_question_id; the question
 * carries the originating template id in meta.template_id.
 */
async function fetchAnsweredTemplateIds(userId: string): Promise<Set<string>> {
  // Pull every question this user answered, joined to the question's meta.
  // We use a two-step lookup because PostgREST can't filter on jsonb across
  // a foreign-table join easily.
  const { data: answers, error: answersErr } = await supabase
    .from('memory_items')
    .select('related_question_id')
    .eq('author_user_id', userId)
    .eq('kind', 'answer')
    .not('related_question_id', 'is', null);

  if (answersErr) {
    throw new SupabaseMemoryError('Failed to load your answered history', answersErr);
  }

  const questionIds = (answers ?? [])
    .map((r) => r.related_question_id as string | null)
    .filter((x): x is string => !!x);

  if (questionIds.length === 0) return new Set<string>();

  const { data: questions, error: qErr } = await supabase
    .from('memory_items')
    .select('id, meta')
    .in('id', questionIds);

  if (qErr) {
    throw new SupabaseMemoryError('Failed to load question history', qErr);
  }

  const out = new Set<string>();
  for (const q of questions ?? []) {
    // meta is jsonb; the PostgREST client returns it as a plain object.
    const meta = (q.meta ?? {}) as { template_id?: string };
    if (meta.template_id) out.add(meta.template_id);
  }
  return out;
}

// ---- Public API -------------------------------------------------------------

/**
 * Pull one eligible question for the answerer. Strategy:
 *   1. Try real prompt_templates (filter by suggested_for_relationships
 *      including 'parent' or 'grandparent' if any rows match; otherwise fall
 *      back to all templates).
 *   2. Exclude template ids already answered by this user.
 *   3. Exclude session-skipped ids.
 *   4. Pick one weighted-randomly from the eligible set.
 *   5. If no templates exist at all in the DB, draw from FALLBACK_QUESTIONS.
 *
 * Returns null only when the user has truly exhausted everything (template +
 * fallback). The caller then renders the "you've answered everything" state.
 */
export async function fetchNextQuestion(
  userId: string,
  excludeIds: string[],
): Promise<PromptTemplate | null> {
  if (!userId) throw new SupabaseMemoryError('userId is required');

  const skipSet = new Set(excludeIds);

  // 1. Pull templates. We intentionally fetch the full list (small table,
  //    curated, ~15 rows) so we can do role + history filtering client-side.
  const { data: rows, error } = await supabase
    .from('prompt_templates')
    .select('id, category, body, weight, suggested_for_relationships')
    .limit(500);

  if (error) {
    throw new SupabaseMemoryError('Failed to load prompt templates', error);
  }

  const templates = (rows ?? []) as Array<
    PromptTemplate & { suggested_for_relationships: string[] | null }
  >;

  const answered = await fetchAnsweredTemplateIds(userId);

  let eligible: PromptTemplate[] = templates.filter(
    (t) => !answered.has(t.id) && !skipSet.has(t.id),
  );

  // If no DB templates exist, draw from fallbacks (also de-duped against skips).
  if (templates.length === 0) {
    eligible = FALLBACK_QUESTIONS.filter((t) => !skipSet.has(t.id));
  }

  if (eligible.length === 0) return null;

  // Weighted random pick.
  const totalWeight = eligible.reduce((sum, t) => sum + Math.max(1, t.weight), 0);
  let r = Math.random() * totalWeight;
  for (const t of eligible) {
    r -= Math.max(1, t.weight);
    if (r <= 0) {
      return { id: t.id, category: t.category, body: t.body, weight: t.weight };
    }
  }
  // Fallback: last element (shouldn't reach here mathematically)
  const last = eligible[eligible.length - 1]!;
  return { id: last.id, category: last.category, body: last.body, weight: last.weight };
}

/**
 * Submit an answer for one prompt template. Goes through the
 * answer_prompt_template RPC which atomically creates the question wrapper +
 * the answer row server-side.
 *
 * Fallback (in-memory) questions can't be persisted because they don't have
 * a real template row to link to — we throw a recognisable error so the UI
 * can surface a gentle "we're still warming up" message. In practice this
 * only fires when an environment is missing seeds; once seeds are loaded
 * every visible question has a real id.
 */
export async function submitAnswer(args: {
  questionId: string;
  body: string;
  mediaAssetId?: string;
}): Promise<{ answerId: string; questionMemoryId: string }> {
  if (!args.body || args.body.trim().length === 0) {
    throw new SupabaseMemoryError('Answer cannot be empty');
  }
  if (isFallbackQuestion(args.questionId)) {
    throw new SupabaseMemoryError(
      "We're still warming up your prompt list — try refreshing in a moment.",
    );
  }

  const { data, error } = await supabase.rpc('answer_prompt_template', {
    p_template_id: args.questionId,
    p_body: args.body.trim(),
  });

  if (error) {
    throw new SupabaseMemoryError('Could not save your answer', error);
  }

  // The RPC returns table(answer_id uuid, question_id uuid) — PostgREST
  // surfaces that as an array of one row.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.answer_id || !row.question_id) {
    throw new SupabaseMemoryError('Save succeeded but no id was returned');
  }

  const answerId = row.answer_id as string;

  // Optional media attachment — link the just-uploaded asset to the answer
  // via the memory_media join table. Non-fatal on failure: the answer is
  // already saved, the photo just won't show in the timeline.
  if (args.mediaAssetId) {
    const { error: linkErr } = await supabase
      .from('memory_media')
      .insert({ memory_id: answerId, media_id: args.mediaAssetId, position: 0 });
    if (linkErr) {
      // eslint-disable-next-line no-console
      console.warn('[supabaseMemory] memory_media link failed:', linkErr.message);
    }
  }

  return {
    answerId,
    questionMemoryId: row.question_id as string,
  };
}

/**
 * Pull every answer authored by `userId`, joined to the question text they
 * answered. Most-recent first. RLS keeps this safe across users: a viewer
 * only gets rows whose memory_items policy allows them, so a kid viewing
 * a parent's timeline only sees the answers they're permitted to read.
 */
export async function fetchMyTimeline(userId: string): Promise<MemoryAnswer[]> {
  if (!userId) throw new SupabaseMemoryError('userId is required');

  const { data, error } = await supabase
    .from('memory_items')
    .select(
      `
      id,
      body,
      created_at,
      author_user_id,
      related_question_id,
      question:related_question_id (
        id,
        body
      )
      `,
    )
    .eq('author_user_id', userId)
    .eq('kind', 'answer')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new SupabaseMemoryError('Failed to load timeline', error);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    body: string;
    created_at: string;
    author_user_id: string;
    related_question_id: string | null;
    // PostgREST returns the embedded relation as an object (or array if many
    // matches). We typed it as a single object since related_question_id is
    // a scalar FK, but defensively handle both.
    question: { id: string; body: string } | { id: string; body: string }[] | null;
  }>;

  return rows.map((r) => {
    const qRaw = Array.isArray(r.question) ? r.question[0] ?? null : r.question;
    return {
      id: r.id,
      body: r.body ?? '',
      createdAt: r.created_at,
      authorUserId: r.author_user_id,
      question: qRaw ? { id: qRaw.id, body: qRaw.body } : null,
    };
  });
}

/**
 * Cheap count for the "X answers so far" widget. Uses a head-only count
 * request so we don't pull rows the UI doesn't need.
 */
export async function countMyAnswers(userId: string): Promise<number> {
  if (!userId) throw new SupabaseMemoryError('userId is required');

  const { count, error } = await supabase
    .from('memory_items')
    .select('id', { count: 'exact', head: true })
    .eq('author_user_id', userId)
    .eq('kind', 'answer')
    .is('deleted_at', null);

  if (error) {
    throw new SupabaseMemoryError('Failed to count answers', error);
  }
  return count ?? 0;
}
