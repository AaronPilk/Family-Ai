import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, View, Text, Pressable, Switch } from 'react-native';
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
  type ExtendedMember,
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
import { useHasFamily } from '../../lib/useHasFamily';
import { useIsDevUser } from '../../lib/useIsDevUser';
import { DemoModeBanner } from '../../components/DemoModeBanner';
import { DEMO_PEOPLE_LIST, demoMembersAsExtended, eventsFromDemo } from '../../lib/demoData';
import { useProfile, initialsOf } from '../../lib/useProfile';
import {
  fetchMyFamily,
  type FamilyBranch,
  type FamilyGraph,
  type FamilyMember,
} from '../../lib/supabaseFamily';
import { RelationshipTagModal } from '../../components/RelationshipTagModal';

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
  const isDevUser = useIsDevUser();
  const { hasFamily, loading, refresh } = useHasFamily();
  const { profile } = useProfile();

  // Refresh family count when the Family tab is shown — it's the most likely
  // place to learn that a new member joined.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-mode family graph (immediate + branches + untagged queue).
  const [graph, setGraph] = useState<FamilyGraph | null>(null);
  const [tagQueue, setTagQueue] = useState<FamilyMember[]>([]);
  const [currentTagTarget, setCurrentTagTarget] = useState<FamilyMember | null>(null);

  const reloadGraph = useCallback(async () => {
    if (!hasFamily) {
      setGraph(null);
      setTagQueue([]);
      setCurrentTagTarget(null);
      return;
    }
    try {
      const g = await fetchMyFamily();
      setGraph(g);
      // Replace the queue on each reload. Don't auto-pop the modal here —
      // showing it only when the user is on the tab is the parent's job;
      // we just stage members so the user can dismiss the surfacing card.
      setTagQueue(g.untagged);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[family] fetchMyFamily failed:', e);
      setGraph({ circleId: null, immediate: [], branches: [], untagged: [] });
      setTagQueue([]);
    }
  }, [hasFamily]);

  useEffect(() => {
    void reloadGraph();
  }, [reloadGraph]);

  // Advance the queue when the current target closes.
  const advanceTagQueue = useCallback(() => {
    setCurrentTagTarget(null);
    // After close, pop the head off the queue. The component re-renders and
    // the user can tap the next surfaced card if they want to keep going.
    setTagQueue((q) => q.slice(1));
  }, []);

  const openNextTagTarget = useCallback(() => {
    setCurrentTagTarget(tagQueue[0] ?? null);
  }, [tagQueue]);

  // Members across in-scope branches, deduped, excluding 'me'
  const memberIds = Array.from(new Set(scopedIds.flatMap((bid) => BRANCHES[bid].memberIds))).filter(
    (id) => id !== 'me',
  ) as MemberId[];
  const immediateIds = memberIds.filter((id) => isImmediate(id));
  const otherCoreIds = memberIds.filter((id) => !isImmediate(id));
  // Extended members visible based on current branch scope.
  const realExtended = Object.values(EXTENDED_MEMBERS).filter(
    (m): m is ExtendedMember => !!m && scopedIds.includes(m.branchId),
  );
  const demoExtended = hasFamily ? [] : demoMembersAsExtended();
  const extendedList: ExtendedMember[] = [...realExtended, ...demoExtended];

  // Upcoming events surface here too so Family becomes the people-and-plans hub.
  const realEvents = useEventsInBranches(scopedIds);
  const eventsForFamily = hasFamily ? realEvents : eventsFromDemo();
  const upcomingEvents = eventsForFamily
    .filter((e) => e.status !== 'past')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 2);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={tokens.color.accentPrimary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      {!hasFamily && (
        <View style={{ paddingTop: insets.top }}>
          <DemoModeBanner />
        </View>
      )}
      <ScrollView
        contentContainerStyle={{
          paddingTop: hasFamily ? insets.top + 8 : 8,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 120,
          gap: 22,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1 }}>
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
          {/* Profile chip — initials → /profile. Long-press not used; the chip is
              big enough to tap directly, and a long-press handler conflicts with
              the chat-screen tab-bar long-press the design rules suggested. */}
          <Pressable
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
            accessibilityLabel="Open your profile"
            hitSlop={8}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: tokens.color.bgTinted,
              borderWidth: 1,
              borderColor: tokens.color.accentSecondary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: tokens.color.accentPrimary,
              }}
            >
              {initialsOf(profile?.displayName)}
            </Text>
          </Pressable>
        </View>

        {/* Invite via link — the easiest way to onboard real family fast. */}
        <Pressable
          onPress={() => router.push('/invite')}
          style={({ pressed }) => ({
            backgroundColor: tokens.color.accentPrimary,
            borderRadius: 16,
            paddingHorizontal: 18,
            paddingVertical: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            opacity: pressed ? 0.85 : 1,
            shadowColor: tokens.color.accentPrimary,
            shadowOpacity: 0.18,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          })}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 22 }}>🔗</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>
              Invite via link
            </Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>
              Drop one link in your family group chat. Anyone who taps it joins.
            </Text>
          </View>
          <Text style={{ fontSize: 22, color: 'white' }}>›</Text>
        </Pressable>

        {/* Letters — quiet entry point. Letters are a private surface; we
            intentionally don't promote them on the main tab bar. */}
        <Pressable
          onPress={() => router.push('/letters')}
          style={({ pressed }) => ({
            backgroundColor: tokens.color.bgPrimary,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: tokens.color.borderSubtle,
            paddingHorizontal: 16,
            paddingVertical: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: tokens.color.bgTinted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 20 }}>✉️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: tokens.color.textPrimary }}>
              Letters
            </Text>
            <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}>
              Private one-way messages for hard-to-say things.
            </Text>
          </View>
          <Text style={{ fontSize: 22, color: tokens.color.textMuted }}>›</Text>
        </Pressable>

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

        {/* "Who is this to you?" surfacing card — only when we have queued
            untagged members AND the user is on this tab. Tapping kicks off
            the modal. We don't auto-open on mount so we're not annoying. */}
        {hasFamily && tagQueue.length > 0 && !currentTagTarget && (
          <Pressable
            onPress={openNextTagTarget}
            style={({ pressed }) => ({
              backgroundColor: tokens.color.bgTinted,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: tokens.color.accentPrimary + '33',
              paddingHorizontal: 16,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: 24 }}>👋</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: tokens.color.textPrimary,
                }}
              >
                {tagQueue.length === 1
                  ? `Tag ${tagQueue[0].displayName}`
                  : `Tag ${tagQueue.length} new family members`}
              </Text>
              <Text
                style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}
              >
                Help FamLink know who's in your inner ring vs. extended.
              </Text>
            </View>
            <Text style={{ fontSize: 22, color: tokens.color.accentPrimary }}>›</Text>
          </Pressable>
        )}

        {/* ============================================================== */}
        {/* REAL MODE — graph-driven immediate + branches                 */}
        {/* ============================================================== */}
        {hasFamily && graph && (
          <>
            {/* Your family — inner ring (avatar row) */}
            <Section title="Your family">
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
                The people you build long-term memory with — parents, siblings, spouse,
                grandparents. Default audience for Vault releases and Letters.
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 14, paddingVertical: 8, paddingHorizontal: 2 }}
              >
                {graph.immediate.map((m) => (
                  <ImmediateAvatarTile key={m.userId} member={m} />
                ))}
                <AddImmediateTile
                  hasExtended={graph.branches.length > 0 || tagQueue.length > 0}
                  onPress={openNextTagTarget}
                />
              </ScrollView>
              {graph.immediate.length === 0 && (
                <Text
                  style={{
                    fontSize: 13,
                    color: tokens.color.textSecondary,
                    lineHeight: 19,
                    paddingHorizontal: 4,
                  }}
                >
                  Tag someone as parent, sibling, spouse, or grandparent to start your inner
                  ring.
                </Text>
              )}
            </Section>

            {/* Extended family — branches grouped by inviter */}
            {graph.branches.length > 0 && (
              <Section title="Extended family">
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
                  Grouped by who invited them. Default audience for Events and group chat.
                </Text>
                {graph.branches.map((b) => (
                  <BranchDisclosureRow key={b.viaUserId} branch={b} />
                ))}
              </Section>
            )}
          </>
        )}

        {/* ============================================================== */}
        {/* DEMO MODE — keep the old mock-data sections untouched          */}
        {/* ============================================================== */}
        {!hasFamily && (
          <>
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
                    For now, invite people through an event (reunion, vacation, gathering) on the
                    Events tab. The "add to family tree" flow lands in the next update.
                  </Text>
                </View>
              )}
            </Section>

            {/* Extended family — the outer ring (used for events) */}
            {extendedList.length > 0 && (
              <Section title="Demo family (preview)">
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
                  This is what your family tree could look like. Invite real people to replace this
                  preview.
                </Text>
                {extendedList.map((m) => (
                  <ExtendedMemberRowInline
                    key={m.id}
                    member={m}
                    demo={DEMO_PEOPLE_LIST.some((d) => (d.id as string) === (m.id as string))}
                  />
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
          </>
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

        {/* Demo controls — dev-only. Regular users never see this section. */}
        {isDevUser && (
        <Section title="Demo controls (dev only)">
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
            {/* Reset-demo button removed: it called router.replace('/welcome')
                without confirmation and was easy to tap accidentally while
                scrolling, kicking the signed-in user back to the marketing
                screen for no reason. Use /profile → Sign out to actually log
                out, or refresh the page to see the welcome screen again. */}
          </View>
        </Section>
        )}
      </ScrollView>

      {/* "Who is this to you?" modal — driven by the tagQueue */}
      <RelationshipTagModal
        member={currentTagTarget}
        onClose={advanceTagQueue}
        onTagged={() => {
          // Refresh the graph after a tag so the immediate ring updates.
          void reloadGraph();
        }}
      />
    </View>
  );
}

// ----------------------------------------------------------------------------
// Real-mode sub-components
// ----------------------------------------------------------------------------

function ImmediateAvatarTile({ member }: { member: FamilyMember }) {
  return (
    <Pressable
      onPress={() => router.push(`/member/${member.userId}`)}
      style={({ pressed }) => ({
        alignItems: 'center',
        gap: 6,
        width: 84,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: member.avatarColor + '22',
          borderWidth: 2,
          borderColor: tokens.color.accentPrimary + '88',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: member.avatarColor,
            fontWeight: '700',
            fontSize: 22,
          }}
        >
          {member.initials}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: tokens.color.textPrimary,
          textAlign: 'center',
        }}
      >
        {member.displayName.split(/\s+/)[0]}
      </Text>
      {member.relationshipType && (
        <Text
          numberOfLines={1}
          style={{
            fontSize: 10,
            color: tokens.color.textMuted,
            textAlign: 'center',
          }}
        >
          {prettyRelationship(member.relationshipType)}
        </Text>
      )}
    </Pressable>
  );
}

function AddImmediateTile({
  hasExtended,
  onPress,
}: {
  hasExtended: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={hasExtended ? onPress : () => router.push('/invite')}
      style={({ pressed }) => ({
        alignItems: 'center',
        gap: 6,
        width: 84,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: tokens.color.bgTinted,
          borderWidth: 2,
          borderColor: tokens.color.borderSubtle,
          borderStyle: 'dashed',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: tokens.color.accentPrimary,
            fontWeight: '700',
            fontSize: 28,
          }}
        >
          +
        </Text>
      </View>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: tokens.color.accentPrimary,
          textAlign: 'center',
        }}
      >
        Add
      </Text>
    </Pressable>
  );
}

function BranchDisclosureRow({ branch }: { branch: FamilyBranch }) {
  const [open, setOpen] = useState(false);
  const initials = (() => {
    const parts = branch.branchName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  })();
  return (
    <View
      style={{
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        overflow: 'hidden',
        marginBottom: 8,
      }}
    >
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => ({
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
            borderRadius: 22,
            backgroundColor: tokens.color.accentSecondary + '33',
            borderWidth: 1,
            borderColor: tokens.color.accentSecondary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: tokens.color.accentPrimary,
              fontWeight: '700',
              fontSize: 15,
            }}
          >
            {initials}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontSize: 15, fontWeight: '700', color: tokens.color.textPrimary }}
          >
            Through {branch.branchName}
          </Text>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}>
            {branch.memberCount} {branch.memberCount === 1 ? 'person' : 'people'}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 18,
            color: tokens.color.textMuted,
            transform: [{ rotate: open ? '90deg' : '0deg' }],
          }}
        >
          ›
        </Text>
      </Pressable>
      {open && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: tokens.color.borderSubtle,
            paddingVertical: 6,
            paddingHorizontal: 8,
          }}
        >
          {branch.members.map((m) => (
            <Pressable
              key={m.userId}
              onPress={() => router.push(`/member/${m.userId}`)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 8,
                paddingHorizontal: 6,
                borderRadius: 10,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: m.avatarColor + '22',
                  borderWidth: 1,
                  borderColor: m.avatarColor + '44',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color: m.avatarColor,
                    fontWeight: '700',
                    fontSize: 12,
                  }}
                >
                  {m.initials}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 14, color: tokens.color.textPrimary, fontWeight: '600' }}
                >
                  {m.displayName}
                </Text>
                {m.relationshipType && (
                  <Text style={{ fontSize: 11, color: tokens.color.textMuted, marginTop: 1 }}>
                    {prettyRelationship(m.relationshipType)}
                  </Text>
                )}
              </View>
              <Text style={{ fontSize: 18, color: tokens.color.textMuted }}>›</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function prettyRelationship(type: string): string {
  switch (type) {
    case 'parent':
      return 'Parent';
    case 'child':
      return 'Child';
    case 'grandparent':
      return 'Grandparent';
    case 'grandchild':
      return 'Grandchild';
    case 'sibling':
      return 'Sibling';
    case 'spouse':
      return 'Spouse';
    case 'aunt_uncle':
      return 'Aunt / uncle';
    case 'niece_nephew':
      return 'Niece / nephew';
    case 'cousin':
      return 'Cousin';
    case 'in_law':
      return 'In-law';
    case 'family_friend':
      return 'Family friend';
    case 'chosen_family':
      return 'Chosen family';
    default:
      return 'Family';
  }
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

function ExtendedMemberRowInline({ member: m, demo }: { member: ExtendedMember; demo?: boolean }) {
  return (
    <Pressable
      onPress={() => !demo && comingSoon('extended_member_profile')}
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
          {demo && (
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 1,
                backgroundColor: tokens.color.accentPrimary + '18',
                borderRadius: 4,
              }}
            >
              <Text style={{ fontSize: 10, color: tokens.color.accentPrimary, fontWeight: '700' }}>
                DEMO
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
