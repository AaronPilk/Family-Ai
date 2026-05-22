import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';

/**
 * 6-tab bottom bar: Home / Ask / Tree / Events / Chats / Family.
 *
 * Vault was on the bar but got pulled — it's a quiet, occasional surface
 * (proof-of-life is high-stakes but low-frequency). Reaching Vault now goes
 * Family tab → Vault card. The tab slot freed up belongs to Family Tree, a
 * read-only generational view that gets opened more often once the graph
 * starts filling in.
 *
 * Chats is the messaging hub — one row per event group chat for v0.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.color.accentPrimary,
        tabBarInactiveTintColor: tokens.color.textMuted,
        tabBarStyle: {
          backgroundColor: tokens.color.bgPrimary,
          borderTopColor: tokens.color.borderSubtle,
          height: 86,
          paddingBottom: 26,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500', marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          title: 'Ask',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="help-circle-outline" size={size + 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tree"
        options={{
          title: 'Tree',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="git-network-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Vault is intentionally NOT a tab. Reach it from Family → Vault card. */}
      <Tabs.Screen
        name="vault"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: 'Family',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
