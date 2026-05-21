import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStatus } from '../lib/sessionStore';
import { tokens } from '../theme/tokens';

/**
 * Root route. Routes by auth status:
 *  - loading: a small spinner while the persisted session is read from
 *             SecureStore
 *  - signed-out: → /welcome (the FamLink intro + sign-up/sign-in entry)
 *  - signed-in:  → /(tabs)   (the real app)
 */
export default function Index() {
  const status = useAuthStatus();

  if (status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.color.bgSecondary,
        }}
      >
        <ActivityIndicator color={tokens.color.accentPrimary} />
      </View>
    );
  }

  if (status === 'signed-out') {
    return <Redirect href="/welcome" />;
  }

  return <Redirect href="/(tabs)" />;
}
