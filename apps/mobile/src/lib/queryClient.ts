/**
 * Stub — real TanStack QueryClient lands in Batch 1.
 *
 * Same posture as ./supabase: any access throws so a missing wire-up is loud.
 */
const message =
  '[queryClient] Real QueryClient not configured. This is a v0 stub. ' +
  'Wire it back into _layout.tsx and provide a real QueryClientProvider before importing.';

export const queryClient: any = new Proxy(
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
