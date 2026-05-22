/**
 * Family tree — read-only generational view of the user's family.
 *
 * Tiers stack vertically:
 *   -2 grandparents
 *   -1 parents / aunts-uncles / in-laws
 *    0 you, spouse, siblings, cousins, chosen family, family friends
 *   +1 children, nieces/nephews
 *   +2 grandchildren
 *
 * Each tier is horizontally scrollable. Connecting lines drop between tiers as
 * thin dividers in the borderStrong token — we don't draw per-person edges
 * because we can't always know which grandparent is whose parent. The "you"
 * tile is larger and accent-bordered to anchor the layout.
 *
 * Untagged members and "custom"-tagged members get parked in a strip at the
 * bottom; tapping one opens the existing RelationshipTagModal so the user can
 * place them on the tree without leaving the screen.
 *
 * Tap a tile → /member/[id]. No drag-and-drop, no inline editing.
 *
 * No react-native-svg dependency: lines are 1.5px <View> rectangles, which
 * renders identically on iOS, Android, and react-native-web.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import {
  fetchMyFamily,
  relationshipLabelFor,
  type FamilyGraph,
  type FamilyMember,
  type RelationshipType,
} from '../../lib/supabaseFamily';
import { RelationshipTagModal } from '../../components/RelationshipTagModal';
import { useHasFamily } from '../../lib/useHasFamily';
import { useProfile, initialsOf } from '../../lib/useProfile';

// ---- Tier model ------------------------------------------------------------

type Tier = -2 | -1 | 0 | 1 | 2;

/**
 * Map a relationships row label (their relationship TO the viewer) to a tier
 * relative to the viewer. The viewer sits at 0.
 */
function tierFor(type: string | null | undefined): Tier | null {
  switch (type) {
    case 'grandparent':
      return -2;
    case 'parent':
    case 'aunt_uncle':
    case 'in_law':
      return -1;
    case 'sibling':
    case 'spouse':
    case 'cousin':
    case 'chosen_family':
    case 'family_friend':
      return 0;
    case 'child':
    case 'niece_nephew':
      return 1;
    case 'grandchild':
      return 2;
    default:
      return null; // custom / untagged → parked
  }
}

function tierLabel(t: Tier): string {
  switch (t) {
    case -2:
      return 'Grandparents';
    case -1:
      return 'Parents';
    case 0:
      return 'You & your generation';
    case 1:
      return 'Children';
    case 2:
      return 'Grandchildren';
  }
}

/**
 * Display label for a tagged relationship. Defers to the lib's
 * relationshipLabelFor so the gendered form ("Brother", "Mom") wins when
 * the tagger left a gender_hint or the target has a profile gender set.
 */
function relationshipShort(
  type: string | null,
  gender?: FamilyMember['gender'],
  genderHint?: FamilyMember['genderHint'],
): string {
  if (!type) return '';
  return relationshipLabelFor(type as RelationshipType, gender ?? null, genderHint ?? null);
}

/**
 * Order members inside a tier. For tier 0, put spouse adjacent to "you", then
 * siblings, then the rest. For other tiers, parents before aunts/uncles, etc.
 */
function sortKey(m: FamilyMember): number {
  switch (m.relationshipType) {
    case 'spouse':
      return 0;
    case 'sibling':
      return 1;
    case 'parent':
      return 0;
    case 'child':
      return 0;
    case 'grandparent':
      return 0;
    case 'grandchild':
      return 0;
    case 'aunt_uncle':
      return 2;
    case 'in_law':
      return 3;
    case 'cousin':
      return 4;
    case 'niece_nephew':
      return 2;
    case 'chosen_family':
      return 5;
    case 'family_friend':
      return 6;
    default:
      return 9;
  }
}

// ---- Screen ----------------------------------------------------------------

export default function FamilyTreeScreen() {
  const insets = useSafeAreaInsets();
  const { hasFamily, loading: hasFamilyLoading } = useHasFamily();
  const { profile } = useProfile();
  const [graph, setGraph] = useState<FamilyGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tagTarget, setTagTarget] = useState<FamilyMember | null>(null);

  const reload = useCallback(async () => {
    if (!hasFamily) {
      setGraph(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const g = await fetchMyFamily();
      setGraph(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your tree.');
      setGraph(null);
    } finally {
      setLoading(false);
    }
  }, [hasFamily]);

  useEffect(() => {
    if (!hasFamilyLoading) {
      void reload();
    }
  }, [hasFamilyLoading, reload]);

  // Group all members (immediate + extended) by tier.
  const tiered = useMemo(() => {
    const buckets = new Map<Tier, FamilyMember[]>();
    const parked: FamilyMember[] = [];
    if (!graph) return { buckets, parked };
    const all = [...graph.immediate, ...graph.branches.flatMap((b) => b.members)];
    for (const m of all) {
      const t = tierFor(m.relationshipType);
      if (t === null) {
        parked.push(m);
      } else {
        const list = buckets.get(t) ?? [];
        list.push(m);
        buckets.set(t, list);
      }
    }
    for (const list of buckets.values()) {
      list.sort((a, b) => sortKey(a) - sortKey(b) || a.displayName.localeCompare(b.displayName));
    }
    parked.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return { buckets, parked };
  }, [graph]);

  // What tiers should we render? Always show tier 0 (the YOU tile sits there).
  // For other tiers, show only if there are members, or if a neighbouring tier
  // exists but this one is empty (then we show a "missing" placeholder).
  const renderTiers = useMemo<Tier[]>(() => {
    const occupied = new Set<Tier>([0]);
    for (const t of tiered.buckets.keys()) occupied.add(t);
    // Bridge: if -2 has people but -1 doesn't, still render -1 as a placeholder
    // so the chain of lines makes sense.
    if (occupied.has(-2) && !occupied.has(-1)) occupied.add(-1);
    if (occupied.has(2) && !occupied.has(1)) occupied.add(1);
    const list = Array.from(occupied).sort((a, b) => a - b);
    return list as Tier[];
  }, [tiered.buckets]);

  // ---- Render ----

  if (loading || hasFamilyLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
        <Header insetTop={insets.top} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={tokens.color.accentPrimary} />
        </View>
      </View>
    );
  }

  const totalTagged = Array.from(tiered.buckets.values()).reduce((n, list) => n + list.length, 0);
  const youInitials = initialsOf(profile?.displayName);
  const youFirstName = (profile?.displayName ?? '').split(/\s+/)[0] || 'You';

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <Header insetTop={insets.top} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 0,
        }}
      >
        {error && (
          <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
            <Text style={{ color: tokens.color.danger, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {/* Zero-state */}
        {totalTagged === 0 && tiered.parked.length === 0 ? (
          <ZeroState youInitials={youInitials} youFirstName={youFirstName} />
        ) : (
          <View style={{ paddingHorizontal: 0 }}>
            {renderTiers.map((tier, idx) => {
              const members = tiered.buckets.get(tier) ?? [];
              const isLast = idx === renderTiers.length - 1;
              return (
                <View key={tier}>
                  <TierRow
                    tier={tier}
                    members={members}
                    youInitials={youInitials}
                    youFirstName={youFirstName}
                  />
                  {!isLast && <Connector />}
                </View>
              );
            })}

            {tiered.parked.length > 0 && (
              <UntaggedStrip
                members={tiered.parked}
                onTap={(m) => setTagTarget(m)}
              />
            )}
          </View>
        )}

        {/* Footer hint */}
        {totalTagged > 0 && (
          <Text
            style={{
              paddingHorizontal: 20,
              paddingTop: 16,
              fontSize: 12,
              color: tokens.color.textMuted,
              lineHeight: 18,
              textAlign: 'center',
            }}
          >
            Tap any tile to open their profile. To change a relationship, head back to the
            Family tab.
          </Text>
        )}
      </ScrollView>

      {/* Re-use the existing tag modal for untagged tiles */}
      <RelationshipTagModal
        member={tagTarget}
        onClose={() => setTagTarget(null)}
        onTagged={() => {
          void reload();
        }}
      />
    </View>
  );
}

// ---- Header ----------------------------------------------------------------

function Header({ insetTop }: { insetTop: number }) {
  return (
    <View
      style={{
        paddingTop: insetTop + 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: tokens.color.borderSubtle,
        backgroundColor: tokens.color.bgSecondary,
      }}
    >
      <Pressable
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/family');
        }}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Back to Family"
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: tokens.color.bgPrimary,
          borderWidth: 1,
          borderColor: tokens.color.borderSubtle,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.5 : 1,
        })}
      >
        <Text style={{ fontSize: 20, color: tokens.color.textPrimary, marginTop: -2 }}>‹</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: tokens.color.textPrimary }}>
          Your family tree
        </Text>
        <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 1 }}>
          Generations at a glance
        </Text>
      </View>
    </View>
  );
}

// ---- Tier row --------------------------------------------------------------

function TierRow({
  tier,
  members,
  youInitials,
  youFirstName,
}: {
  tier: Tier;
  members: FamilyMember[];
  youInitials: string;
  youFirstName: string;
}) {
  // For tier 0 we inject the YOU tile in the centre of the row. Spouse goes
  // immediately to the right of YOU; siblings spread to the left/right.
  const isYou = tier === 0;
  const empty = !isYou && members.length === 0;

  return (
    <View style={{ paddingTop: 12, paddingBottom: 4 }}>
      <Text
        style={{
          paddingHorizontal: 20,
          fontSize: 11,
          fontWeight: '700',
          color: tokens.color.textMuted,
          letterSpacing: 1,
          marginBottom: 8,
        }}
      >
        {tierLabel(tier).toUpperCase()}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: 12,
          paddingHorizontal: 20,
          paddingVertical: 6,
          alignItems: 'center',
          // Centre when content is narrow enough to fit (web especially)
          minWidth: '100%',
          justifyContent: members.length === 0 && !isYou ? 'flex-start' : 'center',
        }}
      >
        {isYou ? (
          <YouAndGeneration
            members={members}
            youInitials={youInitials}
            youFirstName={youFirstName}
          />
        ) : empty ? (
          <MissingTile tier={tier} />
        ) : (
          members.map((m) => <PersonTile key={m.userId} member={m} />)
        )}
      </ScrollView>
    </View>
  );
}

function YouAndGeneration({
  members,
  youInitials,
  youFirstName,
}: {
  members: FamilyMember[];
  youInitials: string;
  youFirstName: string;
}) {
  // Spouse sits immediately right of YOU; siblings/cousins/etc. flank.
  const spouse = members.find((m) => m.relationshipType === 'spouse');
  const left = members.filter((m) => m.relationshipType !== 'spouse');
  return (
    <>
      {left.map((m) => (
        <PersonTile key={m.userId} member={m} />
      ))}
      <YouTile initials={youInitials} firstName={youFirstName} />
      {spouse && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Horizontal "couple" bar */}
          <View
            style={{
              width: 18,
              height: 1.5,
              backgroundColor: tokens.color.accentPrimary,
              alignSelf: 'center',
            }}
          />
          <PersonTile member={spouse} />
        </View>
      )}
    </>
  );
}

// ---- Tiles ------------------------------------------------------------------

function YouTile({ initials, firstName }: { initials: string; firstName: string }) {
  return (
    <View style={{ alignItems: 'center', width: 110 }}>
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: tokens.color.accentPrimary + '14',
          borderWidth: 2.5,
          borderColor: tokens.color.accentPrimary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: tokens.color.accentPrimary,
            fontWeight: '800',
            fontSize: 28,
          }}
        >
          {initials}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{
          marginTop: 6,
          fontSize: 13,
          fontWeight: '700',
          color: tokens.color.textPrimary,
          textAlign: 'center',
        }}
      >
        {firstName}
      </Text>
      <Text
        style={{
          marginTop: 1,
          fontSize: 10,
          fontWeight: '800',
          color: tokens.color.accentPrimary,
          letterSpacing: 1.4,
          textAlign: 'center',
        }}
      >
        YOU
      </Text>
    </View>
  );
}

function PersonTile({ member }: { member: FamilyMember }) {
  return (
    <Pressable
      onPress={() => router.push(`/member/${member.userId}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${member.displayName}`}
      style={({ pressed }) => ({
        alignItems: 'center',
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
          borderWidth: 1.5,
          borderColor: member.avatarColor + '66',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: member.avatarColor, fontWeight: '700', fontSize: 20 }}>
          {member.initials}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{
          marginTop: 6,
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
            marginTop: 1,
            fontSize: 10,
            color: tokens.color.textMuted,
            textAlign: 'center',
          }}
        >
          {relationshipShort(member.relationshipType, member.gender, member.genderHint)}
        </Text>
      )}
    </Pressable>
  );
}

function MissingTile({ tier }: { tier: Tier }) {
  const label =
    tier === -1
      ? 'Tag a parent →'
      : tier === 1
      ? 'Tag a child →'
      : 'Missing';
  return (
    <Pressable
      onPress={() => router.push('/(tabs)/family')}
      style={({ pressed }) => ({
        alignItems: 'center',
        width: 140,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: tokens.color.bgTinted,
          borderWidth: 1.5,
          borderColor: tokens.color.borderStrong,
          borderStyle: 'dashed',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 22, color: tokens.color.textMuted }}>?</Text>
      </View>
      <Text
        style={{
          marginTop: 6,
          fontSize: 11,
          fontWeight: '600',
          color: tokens.color.accentPrimary,
          textAlign: 'center',
          paddingHorizontal: 4,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---- Connector between tiers -----------------------------------------------

function Connector() {
  // A short vertical line centred in the row. Doesn't try to point at a
  // specific person — soft "ancestry" hint only.
  return (
    <View
      style={{
        alignItems: 'center',
        paddingVertical: 6,
      }}
    >
      <View
        style={{
          width: 1.5,
          height: 24,
          backgroundColor: tokens.color.borderStrong,
        }}
      />
    </View>
  );
}

// ---- Untagged strip --------------------------------------------------------

function UntaggedStrip({
  members,
  onTap,
}: {
  members: FamilyMember[];
  onTap: (m: FamilyMember) => void;
}) {
  return (
    <View style={{ paddingTop: 28, paddingBottom: 8 }}>
      <Text
        style={{
          paddingHorizontal: 20,
          fontSize: 11,
          fontWeight: '700',
          color: tokens.color.textMuted,
          letterSpacing: 1,
          marginBottom: 4,
        }}
      >
        UNTAGGED
      </Text>
      <Text
        style={{
          paddingHorizontal: 20,
          fontSize: 12,
          color: tokens.color.textMuted,
          marginBottom: 8,
        }}
      >
        Tap to place them on the tree.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: 12,
          paddingHorizontal: 20,
          paddingVertical: 8,
        }}
      >
        {members.map((m) => (
          <Pressable
            key={m.userId}
            onPress={() => onTap(m)}
            style={({ pressed }) => ({
              alignItems: 'center',
              width: 84,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: m.avatarColor + '14',
                borderWidth: 1.5,
                borderColor: tokens.color.borderStrong,
                borderStyle: 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: m.avatarColor, fontWeight: '700', fontSize: 20 }}>
                {m.initials}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              style={{
                marginTop: 6,
                fontSize: 12,
                fontWeight: '600',
                color: tokens.color.textPrimary,
                textAlign: 'center',
              }}
            >
              {m.displayName.split(/\s+/)[0]}
            </Text>
            <Text
              style={{
                marginTop: 1,
                fontSize: 10,
                color: tokens.color.accentPrimary,
                fontWeight: '700',
                textAlign: 'center',
              }}
            >
              Tap to tag
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ---- Zero state ------------------------------------------------------------

function ZeroState({
  youInitials,
  youFirstName,
}: {
  youInitials: string;
  youFirstName: string;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 24,
        paddingTop: 48,
        alignItems: 'center',
        gap: 20,
      }}
    >
      <YouTile initials={youInitials} firstName={youFirstName} />
      <View style={{ alignItems: 'center', gap: 8, maxWidth: 320 }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            color: tokens.color.textPrimary,
            textAlign: 'center',
          }}
        >
          Your tree starts here.
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: tokens.color.textSecondary,
            textAlign: 'center',
            lineHeight: 21,
          }}
        >
          Tag who's who on the Family tab — your tree fills in as you go.
        </Text>
      </View>
      <Pressable
        onPress={() => router.push('/(tabs)/family')}
        style={({ pressed }) => ({
          marginTop: 8,
          paddingHorizontal: 18,
          paddingVertical: 12,
          backgroundColor: tokens.color.accentPrimary,
          borderRadius: 999,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>
          Go to Family
        </Text>
      </Pressable>
    </View>
  );
}
