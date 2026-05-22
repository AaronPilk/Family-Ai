import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View, Text, Pressable, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../../theme/tokens';
import { MEMBERS, ME, getAnyMember } from '../../../lib/mockData';
import { useEvent, useEventStore } from '../../../lib/eventStore';
import { Avatar } from '../../../components/Avatar';

export default function BringList() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const event = useEvent(id ?? '');
  const toggleChecked = useEventStore((s) => s.toggleBringChecked);
  const claim = useEventStore((s) => s.claimBringItem);
  const addItem = useEventStore((s) => s.addBringItem);
  const [draft, setDraft] = useState('');

  if (!event) return null;

  const mine = event.bringList.filter((b) => b.assigneeId === ME);
  const claimed = event.bringList.filter((b) => b.assigneeId && b.assigneeId !== ME);
  const unclaimed = event.bringList.filter((b) => !b.assigneeId);

  const submit = () => {
    if (!draft.trim()) return;
    addItem(event.id, draft.trim());
    setDraft('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 120,
          gap: 22,
        }}
      >
        <Header title="What we're bringing" subtitle={event.title} />

        {/* Add */}
        <View
          style={{
            backgroundColor: tokens.color.bgPrimary,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: tokens.color.borderSubtle,
            padding: 12,
            gap: 10,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Add to the list (snacks, drinks, board games…)"
            placeholderTextColor={tokens.color.textMuted}
            style={{
              backgroundColor: tokens.color.bgTinted,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 15,
              color: tokens.color.textPrimary,
            }}
            onSubmitEditing={submit}
            returnKeyType="done"
          />
          <Pressable
            onPress={submit}
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              paddingHorizontal: 16,
              paddingVertical: 10,
              backgroundColor: tokens.color.accentPrimary,
              borderRadius: 999,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ color: 'white', fontWeight: '700' }}>+ Add</Text>
          </Pressable>
        </View>

        {/* Yours */}
        {mine.length > 0 && (
          <Section title="You're bringing">
            {mine.map((b) => (
              <Row
                key={b.id}
                text={b.item}
                checked={b.checked}
                assigneeLabel="You"
                onCheck={() => toggleChecked(event.id, b.id)}
              />
            ))}
          </Section>
        )}

        {/* Claimed by others */}
        {claimed.length > 0 && (
          <Section title="Claimed by others">
            {claimed.map((b) => (
              <Row
                key={b.id}
                text={b.item}
                checked={b.checked}
                assigneeLabel={b.assigneeId ? (getAnyMember(b.assigneeId).name || 'Someone') : ''}
                assigneeColor={
                  b.assigneeId ? getAnyMember(b.assigneeId).color : tokens.color.textMuted
                }
                onCheck={() => toggleChecked(event.id, b.id)}
              />
            ))}
          </Section>
        )}

        {/* Unclaimed — easy claim */}
        {unclaimed.length > 0 && (
          <Section title="Up for grabs">
            {unclaimed.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => claim(event.id, b.id, ME)}
                style={({ pressed }) => ({
                  backgroundColor: tokens.color.bgPrimary,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: tokens.color.borderSubtle,
                  padding: 14,
                  marginBottom: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={{ flex: 1, fontSize: 15, color: tokens.color.textPrimary }}>
                  {b.item}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    backgroundColor: tokens.color.bgTinted,
                    borderRadius: 999,
                  }}
                >
                  <Text
                    style={{ fontSize: 12, color: tokens.color.accentPrimary, fontWeight: '700' }}
                  >
                    I'll bring it
                  </Text>
                </View>
              </Pressable>
            ))}
          </Section>
        )}
      </ScrollView>
    </View>
  );
}

function Row({
  text,
  checked,
  assigneeLabel,
  assigneeColor,
  onCheck,
}: {
  text: string;
  checked: boolean;
  assigneeLabel: string;
  assigneeColor?: string;
  onCheck: () => void;
}) {
  return (
    <Pressable
      onPress={onCheck}
      style={({ pressed }) => ({
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        padding: 14,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          backgroundColor: checked ? tokens.color.accentPrimary : 'transparent',
          borderWidth: 2,
          borderColor: checked ? tokens.color.accentPrimary : tokens.color.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && <Text style={{ color: 'white', fontSize: 14, fontWeight: '700' }}>✓</Text>}
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 15,
          color: tokens.color.textPrimary,
          textDecorationLine: checked ? 'line-through' : 'none',
          opacity: checked ? 0.6 : 1,
        }}
      >
        {text}
      </Text>
      <Text
        style={{ fontSize: 13, color: assigneeColor ?? tokens.color.textMuted, fontWeight: '600' }}
      >
        {assigneeLabel}
      </Text>
    </Pressable>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: tokens.color.bgPrimary,
          borderWidth: 1,
          borderColor: tokens.color.borderSubtle,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ fontSize: 22, color: tokens.color.textPrimary, marginTop: -2 }}>‹</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: tokens.color.accentPrimary,
            letterSpacing: 1.5,
          }}
        >
          {subtitle.toUpperCase()}
        </Text>
        <Text style={{ fontSize: 24, fontWeight: '700', color: tokens.color.textPrimary }}>
          {title}
        </Text>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: tokens.color.textSecondary,
          letterSpacing: 0.5,
          paddingHorizontal: 4,
        }}
      >
        {title.toUpperCase()}
      </Text>
      <View>{children}</View>
    </View>
  );
}
