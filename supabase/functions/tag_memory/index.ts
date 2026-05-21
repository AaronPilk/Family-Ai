// Edge Function: tag_memory
// Trigger: on INSERT into public.memory_items where kind in ('answer','post','vault_message','imported_post')
// Responsibility: call Claude Haiku to classify content into the topic taxonomy and write ai_tags.
// On each tag above threshold, insert a timeline_placement into the matching topic timeline.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

interface Payload {
  memory_id: string;
}

const TAXONOMY = [
  'childhood','food','love','advice','faith','holidays','funny_stories','lessons',
  'travel','music','work','parenting','school','family_traditions','milestones',
  'photos_old','photos_new','recipes',
];

serve(async (req) => {
  try {
    const payload = (await req.json()) as Payload;
    console.log('tag_memory stub invoked for', payload.memory_id, 'taxonomy size', TAXONOMY.length);

    // TODO Batch 7:
    // 1. Fetch memory_item + linked transcription text
    // 2. Call Claude Haiku with the taxonomy + ask for up to 3 tags + confidences
    // 3. Upsert into public.ai_tags
    // 4. For each tag above threshold (>=0.6), ensure a `topic:<slug>` timeline exists for the circle
    //    and insert a timeline_placements row with placed_by='ai_tag'

    return new Response(
      JSON.stringify({ ok: true, todo: 'implement in Batch 7' }),
      { headers: { 'content-type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});
