/**
 * "Who is this to you?" — a centered card that appears when there are
 * untagged extended members in the user's circle.
 *
 * Behavior:
 *   - render only when `member` is non-null (parent controls the queue)
 *   - tap a chip → call tagRelationship, then onClose() (parent advances)
 *   - "Skip for now" → onClose() without tagging
 *
 * The modal does NOT manage its own queue or visibility timing — that's the
 * Family tab's job. Keeps the component reusable and stateless.
 */

import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';
import {
  GENDERED_RELATIONSHIP_TYPES,
  RELATIONSHIP_LABELS,
  relationshipLabelFor,
  tagRelationship,
  type FamilyMember,
  type RelationshipType,
} from '../lib/supabaseFamily';

/**
 * One chip the picker renders. A neutral chip has genderHint=null and shows
 * the target's gender form (or the fallback neutral label). A gendered chip
 * has genderHint set, shows the explicit "Brother"/"Sister"/etc. label, and
 * records that hint on the relationships row when tapped.
 */
interface ChipChoice {
  /** Stable React key — includes gender hint so a pair has unique keys. */
  key: string;
  type: RelationshipType;
  /** Tagger's perception of the target's gender, if the chip is a gendered one. */
  genderHint: 'female' | 'male' | null;
  label: string;
  isImmediate: boolean;
}

export interface RelationshipTagModalProps {
  /** The member to tag. When null, the modal stays hidden. */
  member: FamilyMember | null;
  /**
   * Called when the user finishes (tagged or skipped). The parent should
   * advance to the next member in its queue.
   */
  onClose: () => void;
  /**
   * Called after a successful tag, so the parent can refresh local data. The
   * boolean tells the parent whether this tag flipped the member to immediate.
   */
  onTagged?: (memberId: string, type: RelationshipType, isImmediate: boolean) => void;
}

/**
 * Build the chip list for a given target. When the target's gender is known
 * (either from their own profile or from a prior gender_hint), show neutral
 * chips and let the label resolver pick the gendered form per chip. When
 * gender is unknown, split each gendered type into a pair so the tagger can
 * declare "Brother" vs "Sister" explicitly.
 *
 * The pair is rendered together so it reads as one decision visually:
 * "Sibling — pick which one."
 */
function buildChipsForMember(member: FamilyMember | null): ChipChoice[] {
  if (!member) return [];
  const knownGender = member.genderHint ?? member.gender;
  const expand = knownGender === null || knownGender === undefined;

  const chips: ChipChoice[] = [];
  for (const r of RELATIONSHIP_LABELS) {
    if (expand && GENDERED_RELATIONSHIP_TYPES.has(r.type)) {
      // Pair: female chip then male chip, side by side.
      chips.push({
        key: `${r.type}:female`,
        type: r.type,
        genderHint: 'female',
        label: relationshipLabelFor(r.type, null, 'female'),
        isImmediate: r.isImmediate,
      });
      chips.push({
        key: `${r.type}:male`,
        type: r.type,
        genderHint: 'male',
        label: relationshipLabelFor(r.type, null, 'male'),
        isImmediate: r.isImmediate,
      });
    } else {
      // Single neutral chip. Label uses known gender if available.
      chips.push({
        key: r.type,
        type: r.type,
        genderHint: null,
        label: relationshipLabelFor(r.type, knownGender ?? null),
        isImmediate: r.isImmediate,
      });
    }
  }
  return chips;
}

export function RelationshipTagModal({
  member,
  onClose,
  onTagged,
}: RelationshipTagModalProps) {
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chips = useMemo(() => buildChipsForMember(member), [member]);

  async function pick(chip: ChipChoice) {
    if (!member || submitting) return;
    setSubmitting(chip.key);
    setError(null);
    try {
      const res = await tagRelationship(member.userId, chip.type, chip.genderHint);
      onTagged?.(member.userId, chip.type, res.isImmediate);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Modal
      visible={!!member}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(26,20,24,0.55)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <View
          style={{
            backgroundColor: tokens.color.bgPrimary,
            borderRadius: 22,
            padding: 22,
            gap: 16,
            width: '100%',
            maxWidth: 420,
          }}
        >
          {member && (
            <>
              {/* Avatar + question */}
              <View style={{ alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: member.avatarColor + '22',
                    borderWidth: 1,
                    borderColor: member.avatarColor + '44',
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
                  style={{
                    fontSize: 19,
                    fontWeight: '700',
                    color: tokens.color.textPrimary,
                    textAlign: 'center',
                  }}
                >
                  Who is{' '}
                  <Text style={{ color: tokens.color.accentPrimary }}>
                    {member.displayName}
                  </Text>{' '}
                  to you?
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: tokens.color.textMuted,
                    textAlign: 'center',
                    lineHeight: 18,
                  }}
                >
                  Inner-ring labels (parent, sibling, spouse…) flag this person as
                  immediate family. Outer-ring labels keep them as extended.
                </Text>
              </View>

              {/* Chip grid */}
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                  justifyContent: 'center',
                }}
              >
                {chips.map((chip) => {
                  const isLoading = submitting === chip.key;
                  return (
                    <Pressable
                      key={chip.key}
                      onPress={() => pick(chip)}
                      disabled={submitting !== null}
                      style={({ pressed }) => ({
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 999,
                        backgroundColor: chip.isImmediate
                          ? tokens.color.accentPrimary + '12'
                          : tokens.color.bgTinted,
                        borderWidth: 1,
                        borderColor: chip.isImmediate
                          ? tokens.color.accentPrimary + '55'
                          : tokens.color.borderSubtle,
                        opacity: pressed ? 0.7 : submitting && !isLoading ? 0.4 : 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      })}
                    >
                      {isLoading ? (
                        <ActivityIndicator
                          size="small"
                          color={tokens.color.accentPrimary}
                        />
                      ) : null}
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '600',
                          color: chip.isImmediate
                            ? tokens.color.accentPrimary
                            : tokens.color.textPrimary,
                        }}
                      >
                        {chip.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {error && (
                <Text
                  style={{
                    color: tokens.color.danger,
                    fontSize: 13,
                    textAlign: 'center',
                  }}
                >
                  {error}
                </Text>
              )}

              {/* Skip */}
              <Pressable
                onPress={onClose}
                disabled={submitting !== null}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  alignItems: 'center',
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: tokens.color.textMuted,
                    fontWeight: '600',
                  }}
                >
                  Skip for now
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
