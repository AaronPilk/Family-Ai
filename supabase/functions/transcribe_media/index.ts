// Edge Function: transcribe_media
// Trigger: on INSERT into storage.objects in the `media` bucket OR a webhook from media_assets.
// Responsibility: download the media, submit to Whisper/Deepgram, write to public.transcriptions.
// This is a v0 stub — implement in Batch 7.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

interface Payload {
  media_id: string;
  storage_path: string;
  language?: string;
}

serve(async (req) => {
  try {
    const payload = (await req.json()) as Payload;
    console.log('transcribe_media stub invoked for', payload.media_id);

    // TODO Batch 7:
    // 1. Resolve a signed URL for storage_path
    // 2. POST to OpenAI Whisper or Deepgram
    // 3. Upsert into public.transcriptions
    // 4. Optionally enqueue tag_memory

    return new Response(
      JSON.stringify({ ok: true, todo: 'implement in Batch 7', media_id: payload.media_id }),
      { headers: { 'content-type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});
