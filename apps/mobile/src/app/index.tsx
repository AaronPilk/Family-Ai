import { Redirect } from 'expo-router';

/**
 * Root route: in v0 we go straight to the welcome screen.
 * Batch 1 (auth) will swap this for: if session → /(tabs), else → /(auth)/welcome
 */
export default function Index() {
  return <Redirect href="/welcome" />;
}
