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

import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';
import {
  RELATIONSHIP_LABELS,
  tagRelationship,
  type FamilyMember,
  type RelationshipType,
} from '../lib/supabaseFamily';

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

export function RelationshipTagModal({
  member,
  onClose,
  onTagged,
}: RelationshipTagModalProps) {
  const [submitting, setSubmitting] = useState<RelationshipType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(type: RelationshipType) {
    if (!member || submitting) return;
    setSubmitting(type);
    setError(null);
    try {
      const res = await tagRelationship(member.userId, type);
      onTagged?.(member.userId, type, res.isImmediate);
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
                {RELATIONSHIP_LABELS.map((r) => {
                  const isLoading = submitting === r.type;
                  return (
                    <Pressable
                      key={r.type}
                      onPress={() => pick(r.type)}
                      disabled={submitting !== null}
                      style={({ pressed }) => ({
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 999,
                        backgroundColor: r.isImmediate
                          ? tokens.color.accentPrimary + '12'
                          : tokens.color.bgTinted,
                        borderWidth: 1,
                        borderColor: r.isImmediate
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
                          color: r.isImmediate
                            ? tokens.color.accentPrimary
                            : tokens.color.textPrimary,
                        }}
                      >
                        {r.label}
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
