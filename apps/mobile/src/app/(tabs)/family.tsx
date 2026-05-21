import { router } from 'expo-router';
import { ScrollView, View, Text, Pressable, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { MEMBERS, BRANCHES, MEMORIES_WITH, type MemberId } from '../../lib/mockData';
import {
  useBranchStore,
  useCurrentBranch,
  useIsMultiBranch,
  useScopedBranchIds,
  useSelection,
} from '../../lib/branchStore';
import { Avatar } from '../../components/Avatar';
import { BranchList } from '../../components/BranchSwitcher';
import { comingSoon } from '../../lib/comingSoon';

export default function FamilyScreen() {
  const insets = useSafeAreaInsets();
  const branch = useCurrentBranch();
  const sel = useSelection();
  const isMulti = useIsMultiBranch();
  const scopedIds = useScopedBranchIds();
  const enableBlended = useBranchStore((s) => s.enableBlendedDemo);
  const disableBlended = useBranchStore((s) => s.disableBlendedDemo);

  // Members across in-scope branches, deduped, excluding 'me'
  const memberIds = Array.from(new Set(scopedIds.flatMap((bid) => BRANCHES[bid].memberIds))).filter(
    (id) => id !== 'me',
  ) as MemberId[];

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
        {/* Header */}
        <View>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: tokens.color.accentPrimary,
              letterSpacing: 1.5,
            }}
          >
            YOUR FAMILY
          </Text>
          <Text style={{ fontSize: 28, fontWeight: '700', color: tokens.color.textPrimary }}>
            {branch.name}
          </Text>
          <Text style={{ fontSize: 14, color: tokens.color.textMuted, marginTop: 4 }}>
            {branch.memberIds.length} members · {branch.memoryCount} memories
          </Text>
        </View>

        {/* Branch list — only when 2+ */}
        {isMulti && (
          <Section title="Your branches">
            <BranchList />
          </Section>
        )}

        {/* Members of the current branch */}
        <Section
          title={
            isMulti
              ? sel === 'all'
                ? 'Everyone across your family'
                : `People in ${branch.shortName}`
              : 'Members'
          }
        >
          <MemberRow memberId="me" subtitleOverride="You" />
          {memberIds.map((id) => (
            <MemberRow key={id} memberId={id} showBranch={sel === 'all'} />
          ))}
          <Pressable
            onPress={() => comingSoon('invite')}
            style={({ pressed }) => ({
              marginTop: 4,
              paddingHorizontal: 18,
              paddingVertical: 12,
              alignSelf: 'flex-start',
              backgroundColor: tokens.color.bgTinted,
              borderRadius: 999,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: tokens.color.accentPrimary, fontWeight: '600' }}>
              {sel === 'all' ? '+ Invite someone' : `+ Invite to ${branch.shortName}`}
            </Text>
          </Pressable>
        </Section>

        {/* Add another branch — soft entry to multi-branch */}
        {!isMulti && (
          <Section title="Need a separate space?">
            <View
              style={{
                backgroundColor: tokens.color.bgTinted,
                borderRadius: 16,
                padding: 16,
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 14, color: tokens.color.textPrimary, lineHeight: 20 }}>
                Some families need separate branches — divorced parents, in-laws, chosen family, or
                a tighter inner circle. You can add one anytime.
              </Text>
              <Pressable
                onPress={() => router.push('/new/branch')}
                style={({ pressed }) => ({
                  marginTop: 4,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  backgroundColor: 'white',
                  borderRadius: 999,
                  alignSelf: 'flex-start',
                  borderWidth: 1,
                  borderColor: tokens.color.accentPrimary,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: tokens.color.accentPrimary, fontWeight: '700' }}>
                  + Start another branch
                </Text>
              </Pressable>
            </View>
          </Section>
        )}

        {/* Settings */}
        <Section title="Settings">
          <View
            style={{
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: tokens.color.borderSubtle,
              overflow: 'hidden',
            }}
          >
            <SettingsRow label="Notifications" />
            <SettingsRow label="Privacy defaults" />
            <SettingsRow label="Text size" />
            <SettingsRow label="Photo books in progress" />
            <SettingsRow label="Export my data" />
          </View>
        </Section>

        {/* Demo controls — clearly labeled so it doesn't look like a real setting */}
        <Section title="Demo controls">
          <View
            style={{
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: tokens.color.borderSubtle,
              padding: 16,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: tokens.color.textPrimary }}>
                  Show blended-family branches
                </Text>
                <Text style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: 2 }}>
                  Reveals a second branch (Dad & stepfamily) so you can preview multi-branch UX.
                </Text>
              </View>
              <Switch
                value={isMulti}
                onValueChange={(v) => (v ? enableBlended() : disableBlended())}
                trackColor={{ true: tokens.color.accentPrimary, false: '#D0CACC' }}
              />
            </View>
            <Pressable
              onPress={() => router.replace('/welcome')}
              style={({ pressed }) => ({
                paddingVertical: 10,
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <Text style={{ color: tokens.color.danger, fontWeight: '600', fontSize: 15 }}>
                Reset demo (back to welcome)
              </Text>
            </Pressable>
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

function MemberRow({
  memberId,
  subtitleOverride,
  showBranch,
}: {
  memberId: keyof typeof MEMBERS;
  subtitleOverride?: string;
  showBranch?: boolean;
}) {
  const m = MEMBERS[memberId];
  const memCount = MEMORIES_WITH[memberId] ?? 0;
  // Find which branches this member belongs to (for the "All my family" chips)
  const branchTags = Object.values(BRANCHES)
    .filter((b) => b.memberIds.includes(memberId as MemberId))
    .map((b) => ({ shortName: b.shortName, color: b.color }));
  return (
    <Pressable
      onPress={() => memberId !== 'me' && router.push(`/member/${memberId}`)}
      style={({ pressed }) => ({
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 14,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        opacity: pressed ? 0.7 : 1,
        marginBottom: 8,
      })}
    >
      <Avatar member={m} size="md" />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: tokens.color.textPrimary }}>
          {m.name}
        </Text>
        <Text style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: 2 }}>
          {subtitleOverride ?? `${m.relationship}${m.age ? ` · ${m.age}` : ''}`}
          {memCount > 0 && memberId !== 'me' ? `  ·  ${memCount} memories` : ''}
        </Text>
        {showBranch && memberId !== 'me' && (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
            {branchTags.map((b) => (
              <View
                key={b.shortName}
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  backgroundColor: b.color + '18',
                  borderRadius: 6,
                }}
              >
                <Text style={{ fontSize: 11, color: b.color, fontWeight: '700' }}>
                  {b.shortName}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
      {memberId !== 'me' && <Text style={{ fontSize: 22, color: tokens.color.textMuted }}>›</Text>}
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
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
      {children}
    </View>
  );
}

function SettingsRow({ label }: { label: string }) {
  return (
    <Pressable
      onPress={() => comingSoon('settings_row')}
      style={({ pressed }) => ({
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: tokens.color.borderSubtle,
        flexDirection: 'row',
        alignItems: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ flex: 1, fontSize: 16, color: tokens.color.textPrimary }}>{label}</Text>
      <Text style={{ fontSize: 20, color: tokens.color.textMuted }}>›</Text>
    </Pressable>
  );
}
