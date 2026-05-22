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
import { tokens } from '../../../theme/tokens';
import { fetchMyFamily, type FamilyMember } from '../../../lib/supabaseFamily';
import { inviteFamilyMembersToEvent } from '../../../lib/supabaseEvents';
import { useEvent } from '../../../lib/eventStore';

/**
 * /moment/[id]/invite-guests
 *
 * Pick connected family members to add to an event in bulk. Replaces the
 * previous "coming soon" stub the "+ Invite someone" button used to fire.
 *
 * Scope of this first version: family multi-select with push notification
 * fanout (via the event_guests trigger). Phone/email invites for non-circle
 * folks already exist via the /invite screen's chip flow and the Create
 * Event email field — adding a third entry point here is queued as a
 * follow-up so this screen ships quickly.
 *
 * Already-invited members (anyone in event.guests with a non-null user_id)
 * are filtered out of the list — re-inviting them would be confusing.
 */
export default function InviteGuestsScreen() {
  const insets = useSafeAreaInsets();
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(eventId ?? '');

  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const alreadyInvitedIds = useMemo(() => {
    const set = new Set<string>();
    if (!event) return set;
    for (const g of event.guests) {
      // EventGuest.memberId can be the user UUID for real members or a
      // mock id for legacy demo rows. We only filter out UUID-shaped ids
      // so demo/email-only guests don't block real family from being added.
      const id = g.memberId as string | undefined;
      if (id && /^[0-9a-f-]{36}$/i.test(id)) set.add(id);
    }
    return set;
  }, [event]);

  const loadFamily = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const graph = await fetchMyFamily();
      const all = [
        ...graph.immediate,
        ...graph.branches.flatMap((b) => b.members),
      ];
      setFamily(all);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load your family.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFamily();
  }, [loadFamily]);

  const candidates = useMemo(
    () => family.filter((m) => !alreadyInvitedIds.has(m.userId)),
    [family, alreadyInvitedIds],
  );

  const toggle = useCallback((userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!eventId || selectedIds.size === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const ids = Array.from(selectedIds);
      const displayNameByUserId: Record<string, string> = {};
      for (const m of family) {
        if (selectedIds.has(m.userId)) {
          displayNameByUserId[m.userId] = m.displayName;
        }
      }
      const { insertedCount } = await inviteFamilyMembersToEvent(eventId, ids, {
        displayNameByUserId,
      });
      // Bounce back to the guests screen — it'll re-hydrate from Supabase
      // and the newly-invited people will show in the "Invited" bucket.
      // If we eventually add optimistic local upsert this can be smoother.
      if (insertedCount > 0) {
        router.back();
      } else {
        setSubmitError('No new invites went out — those people were already on the guest list.');
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not send invites.');
    } finally {
      setSubmitting(false);
    }
  }, [eventId, selectedIds, family]);

  const canSubmit = selectedIds.size > 0 && !submitting;

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
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Text style={{ fontSize: 20, color: tokens.color.textPrimary, marginTop: -2 }}>
            ‹
          </Text>
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
            {(event?.title ?? 'EVENT').toUpperCase()}
          </Text>
          <Text style={{ fontSize: 17, fontWeight: '700', color: tokens.color.textPrimary }}>
            Invite family
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: insets.bottom + 140,
          gap: 16,
        }}
      >
        <Text style={{ fontSize: 14, color: tokens.color.textSecondary, lineHeight: 21 }}>
          Tap anyone in your family to add them to this event. They'll get a push
          notification right away — no extra link to share.
        </Text>

        {loading && (
          <View style={{ paddingVertical: 40, alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color={tokens.color.accentPrimary} />
            <Text style={{ fontSize: 13, color: tokens.color.textMuted }}>
              Loading your family…
            </Text>
          </View>
        )}

        {!loading && loadError && (
          <View
            style={{
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: tokens.color.danger + '40',
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 14, color: tokens.color.textPrimary, fontWeight: '700' }}>
              Couldn't load your family.
            </Text>
            <Text style={{ fontSize: 13, color: tokens.color.textSecondary }}>
              {loadError}
            </Text>
            <Pressable
              onPress={loadFamily}
              style={({ pressed }) => ({
                alignSelf: 'flex-start',
                paddingHorizontal: 14,
                paddingVertical: 8,
                backgroundColor: tokens.color.accentPrimary,
                borderRadius: 999,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>
                Try again
              </Text>
            </Pressable>
          </View>
        )}

        {!loading && !loadError && candidates.length === 0 && (
          <View
            style={{
              backgroundColor: tokens.color.bgTinted,
              borderRadius: 14,
              padding: 16,
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.color.textPrimary }}>
              Everyone's already on the list.
            </Text>
            <Text style={{ fontSize: 13, color: tokens.color.textSecondary, lineHeight: 19 }}>
              You've invited every family member who's joined FamLink. Use Share link
              from the event page to invite anyone not on FamLink yet.
            </Text>
          </View>
        )}

        {!loading && !loadError && candidates.length > 0 && (
          <View style={{ gap: 8 }}>
            {candidates.map((m) => {
              const selected = selectedIds.has(m.userId);
              return (
                <Pressable
                  key={m.userId}
                  onPress={() => toggle(m.userId)}
                  disabled={submitting}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderRadius: 14,
                    backgroundColor: selected
                      ? tokens.color.accentPrimary + '12'
                      : tokens.color.bgPrimary,
                    borderWidth: 1.5,
                    borderColor: selected
                      ? tokens.color.accentPrimary
                      : tokens.color.borderSubtle,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  {/* Avatar */}
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: m.avatarColor + '22',
                      borderWidth: 1,
                      borderColor: m.avatarColor + '44',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: m.avatarColor, fontWeight: '700', fontSize: 15 }}>
                      {m.initials}
                    </Text>
                  </View>
                  {/* Name + tag */}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontSize: 15, fontWeight: '700', color: tokens.color.textPrimary }}
                    >
                      {m.displayName}
                    </Text>
                    {m.relationshipType && (
                      <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 1 }}>
                        {m.relationshipType}
                      </Text>
                    )}
                  </View>
                  {/* Checkmark */}
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      borderWidth: 1.5,
                      borderColor: selected
                        ? tokens.color.accentPrimary
                        : tokens.color.borderSubtle,
                      backgroundColor: selected
                        ? tokens.color.accentPrimary
                        : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selected && (
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>✓</Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {submitError && (
          <View
            style={{
              backgroundColor: tokens.color.danger + '15',
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: tokens.color.danger + '40',
            }}
          >
            <Text style={{ color: tokens.color.danger, fontSize: 13 }}>
              {submitError}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky submit footer */}
      {candidates.length > 0 && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: insets.bottom + 16,
            backgroundColor: tokens.color.bgSecondary,
            borderTopWidth: 1,
            borderTopColor: tokens.color.borderSubtle,
          }}
        >
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => ({
              backgroundColor: canSubmit ? tokens.color.accentPrimary : '#D8C7CC',
              height: 52,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 10,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            {submitting && <ActivityIndicator color="white" />}
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
              {submitting
                ? 'Inviting…'
                : selectedIds.size === 0
                  ? 'Pick at least one'
                  : selectedIds.size === 1
                    ? 'Invite 1 person'
                    : `Invite ${selectedIds.size} people`}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
