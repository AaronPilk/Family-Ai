import { Redirect } from 'expo-router';

/**
 * Legacy redirect: the original onboarding step 1 lived at /onboarding/name
 * and collected the user's name + birthday + son/daughter role inline. That
 * flow has been replaced by the four-screen welcome → how-it-works → role
 * → invite sequence (see /onboarding/welcome). Display name now comes from
 * auth metadata at signup, and birthday lives on the /profile editor.
 *
 * Kept as a stub so any deep links (push notifications, browser history,
 * older email magic links) that still point at /onboarding/name land in
 * the right place.
 */
export default function NameRedirect() {
  return <Redirect href="/onboarding/welcome" />;
}
