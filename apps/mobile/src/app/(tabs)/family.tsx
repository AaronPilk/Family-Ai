import { router } from 'expo-router';
import { ScrollView, View, Text, Pressable, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import {
  MEMBERS,
  BRANCHES,
  EXTENDED_MEMBERS,
  MEMORIES_WITH,
  isImmediate,
  daysUntil,
  type MemberId,
  type ExtendedMemberId,
  type FamilyEvent,
} from '../../lib/mockData';
import {
  useBranchStore,
  useCurrentBranch,
  useIsMultiBranch,
  useScopedBranchIds,
  useSelection,
  useUserRole,
} from '../../lib/branchStore';
import { useEventsInBranches } from '../../lib/eventStore';
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
  const userRole = useUserRole();
  const setUserRole = useBranchStore((s) => s.setUserRole);

  // Members across in-scope branches, deduped, excluding 'me'
  const memberIds = Array.from(new Set(scopedIds.flatMap((bid) => BRANCHES[bid].memberIds))).filter(
    (id) => id !== 'me',
  ) as MemberId[];
  const immediateIds = memberIds.filter((id) => isImmediate(id));
  const otherCoreIds = memberIds.filter((id) => !isImmediate(id));
  // Extended members visible based on current branch scope.
  const extendedIds = Object.values(EXTENDED_MEMBERS)
    .filter((m) => scopedIds.includes(m.branchId))
    .map((m) => m.id);

  // Upcoming events surface here too so Family becomes the people-and-plans hub.
  const upcomingEvents = useEventsInBranches(scopedIds)
    .filter((e) => e.status !== 'past')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 2);

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

        {/* Upcoming events — surface the reunion right under the header */}
        {upcomingEvents.length > 0 && (
          <Section title="Upcoming">
            <View style={{ gap: 10 }}>
              {upcomingEvents.map((e) => (
                <UpcomingEventRow key={e.id} event={e} />
              ))}
              <Pressable
                onPress={() => router.push('/events')}
                style={({ pressed }) => ({
                  alignSelf: 'flex-start',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  backgroundColor: tokens.color.bgTinted,
                  borderRadius: 999,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{ color: tokens.color.accentPrimary, fontWeight: '700', fontSize: 13 }}
                >
                  See all events
                </Text>
              </Pressable>
            </View>
          </Section>
        )}

        {/* Immediate family — the inner ring (used by Ask, Timeline, Vault) */}
        <Section title="Immediate family">
          <Text
            style={{
              fontSize: 12,
              color: tokens.color.textMuted,
              lineHeight: 18,
              paddingHorizontal: 4,
              marginTop: -4,
              marginBottom: 4,
            }}
          >
            The people you ask questions of and build long-term memory with. Mom, Dad, siblings,
            grandparents. Not cousins.
          </Text>
          <MemberRow memberId="me" subtitleOverride="You" />
          {immediateIds.map((id) => (
            <MemberRow key={id} memberId={id} showBranch={sel === 'all'} immediate />
          ))}
          {otherCoreIds.length > 0 && (
            <>
              {otherCoreIds.map((id) => (
                <MemberRow key={id} memberId={id} showBranch={sel === 'all'} />
              ))}
            </>
          )}
          {immediateIds.length === 0 && otherCoreIds.length === 0 && (
            <View
              style={{
                backgroundColor: tokens.color.bgTinted,
                borderRadius: 14,
                padding: 14,
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.color.textPrimary }}>
                Add immediate family — coming next
              </Text>
              <Text style={{ fontSize: 13, color: tokens.color.textSecondary, lineHeight: 19 }}>
                For now, invite people through an event (reunion, vacation, gathering) on the Events
                tab. The "add to family tree" flow lands in the next update.
              </Text>
            </View>
          )}
        </Section>

        {/* Extended family — the outer ring (used for events) */}
        {extendedIds.length > 0 && (
          <Section title="Extended family & guests">
            <Text
              style={{
                fontSize: 12,
                color: tokens.color.textMuted,
                lineHeight: 18,
                paddingHorizontal: 4,
                marginTop: -4,
                marginBottom: 4,
              }}
            >
              Aunts, uncles, cousins, in-laws, and family friends. They show up in your invite list
              for reunions and vacations. Add someone once — they're in your family tree forever.
            </Text>
            {extendedIds.map((id) => (
              <ExtendedMemberRow key={id} memberId={id} />
            ))}
            <Pressable
              onPress={() => comingSoon('invite_extended')}
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
                + Add to family tree
              </Text>
            </Pressable>
          </Section>
        )}

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

        {/* Library — timeline + vault, both moved off the tab bar. */}
        <Section title="Library">
          <Pressable
            onPress={() => router.push('/timeline')}
            style={({ pressed }) => ({
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: tokens.color.borderSubtle,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: tokens.color.bgTinted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 22 }}>📖</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}>
                Timeline
              </Text>
              <Text style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: 2 }}>
                Every memory, sorted by person, topic, or branch.
              </Text>
            </View>
            <Text style={{ fontSize: 22, color: tokens.color.textMuted }}>›</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/vault')}
            style={({ pressed }) => ({
              backgroundColor: tokens.color.bgVault,
              borderRadius: 18,
              padding: 18,
              opacity: pressed ? 0.85 : 1,
              shadowColor: '#000',
              shadowOpacity: 0.3,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
            })}
          >
            <Text style={{ fontSize: 12, color: '#C09155', fontWeight: '700', letterSpacing: 1.2 }}>
              VAULT
            </Text>
            <Text style={{ fontSize: 18, color: 'white', fontWeight: '700', marginTop: 4 }}>
              Leave a message for the future
            </Text>
            <Text style={{ fontSize: 13, color: '#D8C7CC', marginTop: 4, lineHeight: 19 }}>
              Voice, video, or letter — scheduled for a date, a birthday, a milestone. Sealed until
              the moment arrives.
            </Text>
          </Pressable>
        </Section>

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

            {/* Role toggle — flips the Home hero between Answer (elder) and Ask (younger). */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: tokens.color.textPrimary }}>
                Your role on Home
              </Text>
              <Text style={{ fontSize: 13, color: tokens.color.textMuted }}>
                Children see "Ask someone today." Parents and grandparents see "Answer today's
                prompt." This switch lets you flip between the two.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <Pressable
                  onPress={() => setUserRole('younger')}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor:
                      userRole === 'younger' ? tokens.color.accentPrimary : tokens.color.bgTinted,
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: userRole === 'younger' ? 'white' : tokens.color.textPrimary,
                      fontWeight: '700',
                      fontSize: 13,
                    }}
                  >
                    Child / asker
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setUserRole('elder')}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor:
                      userRole === 'elder' ? tokens.color.accentPrimary : tokens.color.bgTinted,
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: userRole === 'elder' ? 'white' : tokens.color.textPrimary,
                      fontWeight: '700',
                      fontSize: 13,
                    }}
                  >
                    Parent / grandparent
                  </Text>
                </Pressable>
              </View>
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
  immediate,
}: {
  memberId: keyof typeof MEMBERS;
  subtitleOverride?: string;
  showBranch?: boolean;
  immediate?: boolean;
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
        borderWidth: immediate ? 1.5 : 1,
        borderColor: immediate ? tokens.color.accentPrimary + '40' : tokens.color.borderSubtle,
        opacity: pressed ? 0.7 : 1,
        marginBottom: 8,
      })}
    >
      <Avatar member={m} size="md" ring={immediate} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: tokens.color.textPrimary }}>
            {m.name}
          </Text>
          {immediate && (
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 1,
                backgroundColor: tokens.color.accentPrimary + '18',
                borderRadius: 4,
              }}
            >
              <Text style={{ fontSize: 10, color: tokens.color.accentPrimary, fontWeight: '700' }}>
                IMMEDIATE
              </Text>
            </View>
          )}
        </View>
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

function ExtendedMemberRow({ memberId }: { memberId: ExtendedMemberId }) {
  const m = EXTENDED_MEMBERS[memberId];
  if (!m) return null;
  return (
    <Pressable
      onPress={() => comingSoon('extended_member_profile')}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: tokens.color.textPrimary }}>
            {m.name}
          </Text>
          {m.metAtEvent && (
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 1,
                backgroundColor: tokens.color.bgTinted,
                borderRadius: 4,
              }}
            >
              <Text style={{ fontSize: 10, color: tokens.color.textMuted, fontWeight: '700' }}>
                MET AT EVENT
              </Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: 2 }}>
          {m.relationship}
          {m.age ? ` · ${m.age}` : ''}
        </Text>
      </View>
      <Text style={{ fontSize: 22, color: tokens.color.textMuted }}>›</Text>
    </Pressable>
  );
}

function UpcomingEventRow({ event }: { event: FamilyEvent }) {
  const days = daysUntil(event.startsAt);
  return (
    <Pressable
      onPress={() => router.push(`/moment/${event.id}`)}
      style={({ pressed }) => ({
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        flexDirection: 'row',
        overflow: 'hidden',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 84,
          backgroundColor: event.coverTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 36 }}>{event.coverGlyph}</Text>
      </View>
      <View style={{ flex: 1, padding: 14, gap: 4 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: tokens.color.accentPrimary,
            letterSpacing: 1.2,
          }}
        >
          {event.kind.toUpperCase()}
          {event.branchIds.length > 1 ? ' · CROSS-BRANCH' : ''}
        </Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}>
          {event.title}
        </Text>
        <Text style={{ fontSize: 12, color: tokens.color.textMuted }}>
          {event.dateRangeText}
          {days >= 0 && days <= 60
            ? `  ·  ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `${days} days away`}`
            : ''}
        </Text>
      </View>
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
