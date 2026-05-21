/**
 * Stub — real Supabase client lands in Batch 1.
 *
 * Importers should NOT call methods on `supabase` from production code paths
 * until the real client is wired. Accessing any property of this stub throws
 * a clear, named error in dev so a missing wire-up doesn't silently no-op.
 */
const message =
  '[supabase] Real Supabase client not configured. This is a v0 stub. ' +
  'Wire the real createClient() in Batch 1 before importing from this module.';

export const supabase: any = new Proxy(
  {},
  {
    get() {
      throw new Error(message);
    },
    apply() {
      throw new Error(message);
    },
  },
);
