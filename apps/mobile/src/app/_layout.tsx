import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { Stack, SplashScreen } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View } from 'react-native';
import tamaguiConfig from '../../tamagui.config';
import { tokens } from '../theme/tokens';
import { initSession } from '../lib/sessionStore';

// Boot the auth subscription once before any screen renders.
initSession();

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Root layout. Uses a Stack (not Slot) so every non-tab route — /member/[id],
 * /memory/[id], /moment/[id], /notifications, /invite, etc. — pushes onto a
 * real navigation stack. Without this, `router.back()` (and browser back on
 * web) had nothing to pop, which is why every back tap was landing on Home
 * regardless of where the user came from.
 *
 * Tab navigation lives inside (tabs)/_layout, which renders its own Tabs
 * navigator below this stack as a single stack frame.
 */
export default function RootLayout() {
  const scheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <SafeAreaProvider>
        <TamaguiProvider config={tamaguiConfig} defaultTheme={scheme ?? 'light'}>
          <StatusBar style="dark" />
          <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: tokens.color.bgSecondary },
              }}
            />
          </View>
        </TamaguiProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
