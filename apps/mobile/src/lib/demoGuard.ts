/**
 * demoGuard.ts — explicit "this is example data" alert for taps on demo
 * content while the user has no real family yet.
 *
 * The DEMO banner at the top of screens warns passively, but users still
 * tap on demo events / members / questions expecting something to happen.
 * The guard intercepts those taps and explains: this isn't your data, here's
 * how to make it real.
 *
 * Usage pattern from any screen:
 *
 *   const guard = useDemoGuard();
 *   <Pressable onPress={() => {
 *     if (guard.tap('event')) return;  // alert shown, abort the real handler
 *     // ...real handler runs only when the user has family
 *   }}>
 *
 * Or directly:
 *   import { showDemoAlert } from '../lib/demoGuard';
 *   onPress={() => showDemoAlert('event')}
 *
 * Native uses Alert.alert; web uses window.confirm so the "Invite family"
 * action can route the user immediately.
 */

import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { useHasFamily } from './useHasFamily';

/**
 * What kind of demo content the user just tapped — drives the body copy.
 * Add more variants as new demo surfaces appear.
 */
export type DemoTapKind =
  | 'event'
  | 'member'
  | 'question'
  | 'answer'
  | 'notification'
  | 'chat'
  | 'photo'
  | 'vault'
  | 'letter'
  | 'generic';

const BODY: Record<DemoTapKind, string> = {
  event:
    "This is example data — a preview of what events look like once your family is on FamLink. Invite them to start planning real reunions and gatherings.",
  member:
    "This is an example family member. Invite your real family to see their profiles, timelines, and stories here.",
  question:
    "This is an example question. Invite your parents or grandparents to start asking and answering real memory questions.",
  answer:
    "This is an example answer. Invite your family — when they answer your questions, their stories show up here for keeps.",
  notification:
    "This is an example notification. You'll get real ones the moment your family starts using FamLink.",
  chat:
    "This is example chat from a fictional family. Invite yours to start a real group chat for an event.",
  photo:
    "This is an example photo. Once your family is here, everyone's reunion photos collect in one place.",
  vault:
    "This is an example Vault item. Vault entries are time-stamped, append-only proof. Invite family first — then you'll be able to release them when you're ready.",
  letter:
    "This is an example letter. Invite your family — then you'll be able to write real ones to mom, dad, anyone.",
  generic:
    "This is example data — a preview of what FamLink looks like once your family is here. Invite them and the demo disappears.",
};

/**
 * Show the demo-data alert. Returns immediately; the alert handles its own
 * dismissal and routing. No-op if called outside a React tree (defensive).
 */
export function showDemoAlert(kind: DemoTapKind = 'generic'): void {
  const title = 'Example data';
  const message = BODY[kind] ?? BODY.generic;

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
      // SSR or unusual env — just log and bail.
      // eslint-disable-next-line no-console
      console.warn('[demoGuard]', message);
      return;
    }
    // Use confirm so the user gets a "Cancel / Invite family" choice.
    const ok = window.confirm(`${title}\n\n${message}\n\nOpen the invite screen?`);
    if (ok) router.push('/invite');
    return;
  }

  Alert.alert(title, message, [
    { text: 'Maybe later', style: 'cancel' },
    {
      text: 'Invite family',
      style: 'default',
      onPress: () => router.push('/invite'),
    },
  ]);
}

/**
 * Hook variant — returns helpers that respect the user's actual family state.
 * `tap(kind)` returns true when the alert was shown (caller should abort).
 * `tap(kind)` returns false when the user has real family (caller proceeds).
 *
 * Use this in tap handlers that should ONLY guard while in demo mode:
 *
 *   const guard = useDemoGuard();
 *   onPress={() => {
 *     if (guard.tap('event')) return;
 *     router.push(`/moment/${eventId}`);
 *   }}
 */
export function useDemoGuard(): {
  isDemo: boolean;
  tap: (kind?: DemoTapKind) => boolean;
} {
  const { hasFamily } = useHasFamily();
  const isDemo = !hasFamily;
  return {
    isDemo,
    tap: (kind: DemoTapKind = 'generic') => {
      if (!isDemo) return false;
      showDemoAlert(kind);
      return true;
    },
  };
}
