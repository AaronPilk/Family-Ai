import { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
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
  type FamilyMember,
  type RelationshipType,
} from '../../lib/supabaseFamily';
import { RelationshipTagModal } from '../../components/RelationshipTagModal';

/**
 * Member profile — `/member/<userId>`.
 *
 * This file used to be wired against mockData (MEMBERS[memberId] keyed by
 * string ids like 'mom'). Every real navigation passes a UUID, so the
 * lookup returned undefined, accessing `member.name` threw, and the screen
 * rendered blank — the symptom Aaron hit trying to re-tag his brother as
 * "Brother." Eight call sites push to this route; every one of them was
 * blank-screening.
 *
 * Scope of this rewrite: enough to unblock that flow. Avatar, name,
 * relationship label (gender-aware via lib), and a "Change relationship"
 * button that re-opens the RelationshipTagModal so re-tagging is reachable
 * from any tile in the app. Shared timeline / questions / vault tabs can
 * layer on later — the goal here is to stop the crash and let users fix
 * incorrect relationship tags.
 */
export default function MemberProfileScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [member, setMember] = useState<FamilyMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tagModalOpen, setTagModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setError('No member id in the URL.');
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // fetchMyFamily returns every family member in the user's primary
      // circle. We just find the one we want — list is at most a few
      // dozen rows, way cheaper than maintaining a separate single-member
      // RPC and easier to keep in sync with display logic.
      const graph = await fetchMyFamily();
      const all = [
        ...graph.immediate,
        ...graph.branches.flatMap((b) => b.members),
      ];
      const found = all.find((m) => m.userId === id) ?? null;
      if (!found) {
        setError(
          "We couldn't find that person in your family. They may have left the circle.",
        );
      }
      setMember(found);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this profile.');
      // eslint-disable-next-line no-console
      console.warn('[member/[id]] fetchMyFamily failed:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Called by the modal after a successful tag. Refetch so any derived
   * state (is_immediate flipping, branch movement, gendered label) stays
   * in sync with the server rather than getting patched optimistically.
   */
  const handleTagged = useCallback(
    (_memberId: string, _type: RelationshipType, _isImmediate: boolean) => {
      void load();
    },
    [load],
  );

  const currentRelationshipLabel = useMemo(() => {
    if (!member?.relationshipType) return null;
    return relationshipLabelFor(
      member.relationshipType as RelationshipType,
      member.gender,
      member.genderHint,
    );
  }, [member?.relationshipType, member?.gender, member?.genderHint]);

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/family');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
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
          onPress={goBack}
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
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Text
            style={{ fontSize: 20, color: tokens.color.textPrimary, marginTop: -2 }}
          >
            ‹
          </Text>
        </Pressable>
        <Text
          style={{ fontSize: 17, fontWeight: '700', color: tokens.color.textPrimary }}
        >
          Profile
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: 32,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 40,
          gap: 24,
          alignItems: 'center',
        }}
      >
        {loading && (
          <View style={{ paddingVertical: 60, alignItems: 'center', gap: 12 }}>
            <ActivityIndicator color={tokens.color.accentPrimary} />
            <Text style={{ color: tokens.color.textMuted, fontSize: 14 }}>
              Loading profile…
            </Text>
          </View>
        )}

        {!loading && error && (
          <View
            style={{
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 16,
              padding: 18,
              borderWidth: 1,
              borderColor: tokens.color.danger + '40',
              gap: 10,
              width: '100%',
            }}
          >
            <Text style={{ fontSize: 32 }}>😔</Text>
            <Text
              style={{ fontSize: 17, fontWeight: '700', color: tokens.color.textPrimary }}
            >
              Couldn't load that profile.
            </Text>
            <Text
              style={{ fontSize: 14, color: tokens.color.textSecondary, lineHeight: 20 }}
            >
              {error}
            </Text>
            <Pressable
              onPress={load}
              style={({ pressed }) => ({
                alignSelf: 'flex-start',
                marginTop: 4,
                paddingHorizontal: 18,
                paddingVertical: 10,
                backgroundColor: tokens.color.accentPrimary,
                borderRadius: 999,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: 'white', fontWeight: '700' }}>Try again</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && member && (
          <>
            {/* Avatar */}
            <View
              style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: member.avatarColor + '22',
                borderWidth: 2,
                borderColor: member.avatarColor + '66',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: member.avatarColor,
                  fontWeight: '700',
                  fontSize: 40,
                }}
              >
                {member.initials}
              </Text>
            </View>

            {/* Name + immediate-family badge */}
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Text
                style={{
                  fontSize: 26,
                  fontWeight: '700',
                  color: tokens.color.textPrimary,
                  textAlign: 'center',
                }}
              >
                {member.displayName}
              </Text>
              {member.isImmediate && (
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    backgroundColor: tokens.color.accentPrimary + '15',
                    borderRadius: 999,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: tokens.color.accentPrimary,
                      letterSpacing: 0.6,
                    }}
                  >
                    IMMEDIATE FAMILY
                  </Text>
                </View>
              )}
            </View>

            {/* Relationship card with Change button */}
            <View
              style={{
                backgroundColor: tokens.color.bgPrimary,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: tokens.color.borderSubtle,
                padding: 20,
                gap: 12,
                width: '100%',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 0.8,
                  color: tokens.color.textMuted,
                }}
              >
                YOUR RELATIONSHIP
              </Text>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '700',
                  color: currentRelationshipLabel
                    ? tokens.color.textPrimary
                    : tokens.color.textMuted,
                }}
              >
                {currentRelationshipLabel ?? 'Not set yet'}
              </Text>
              <Pressable
                onPress={() => setTagModalOpen(true)}
                style={({ pressed }) => ({
                  alignSelf: 'flex-start',
                  marginTop: 4,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  backgroundColor: tokens.color.accentPrimary,
                  borderRadius: 999,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>
                  {currentRelationshipLabel ? 'Change relationship' : 'Set relationship'}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>

      {/* Re-tag modal. Visible only when the user explicitly opens it. */}
      <RelationshipTagModal
        member={tagModalOpen ? member : null}
        onClose={() => setTagModalOpen(false)}
        onTagged={handleTagged}
      />
    </View>
  );
}
