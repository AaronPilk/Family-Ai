/**
 * vault/add — compose a new proof-of-life entry.
 *
 * Big multiline text field with an optional photo attachment that flows
 * through `mediaUpload`. We make the server-stamp + append-only constraint
 * explicit in the copy so the user knows what they're committing to.
 */
import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { addVaultItem } from '../../lib/supabaseVault';
import {
  getPublicUrl,
  pickImage,
  uploadMedia,
  MediaUploadError,
  type MediaAsset,
} from '../../lib/mediaUpload';
import { VaultTrustBadge } from '../../components/VaultTrustBadge';

const MAX_LEN = 10000;

export default function AddVaultEntryScreen() {
  const insets = useSafeAreaInsets();
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<MediaAsset | null>(null);
  const [attaching, setAttaching] = useState(false);

  async function onAttachPhoto() {
    if (attaching || saving) return;
    setError(null);
    setAttaching(true);
    try {
      const picked = await pickImage({ mediaTypes: 'photo' });
      if (!picked) {
        setAttaching(false);
        return;
      }
      const asset = await uploadMedia(picked, { kind: 'photo' });
      setAttachment(asset);
    } catch (e) {
      const msg =
        e instanceof MediaUploadError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Couldn't attach that photo.";
      setError(msg);
    } finally {
      setAttaching(false);
    }
  }

  function onRemoveAttachment() {
    if (saving) return;
    setAttachment(null);
  }

  const nowLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, []);

  const canSubmit = (body.trim().length > 0 || attachment != null) && !saving && !attaching;

  async function onSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await addVaultItem({ body, mediaAssetId: attachment?.id });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your entry.');
      setSaving(false);
    }
  }

  function confirmCancel() {
    if (body.trim().length === 0 && !attachment) {
      router.back();
      return;
    }
    Alert.alert('Discard this entry?', 'You haven\'t saved it yet.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 40,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={confirmCancel}
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
            <Text style={{ fontSize: 18, color: tokens.color.textPrimary }}>✕</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: tokens.color.accentGold,
                letterSpacing: 1.5,
              }}
            >
              NEW VAULT ENTRY
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '700', color: tokens.color.textPrimary }}>
              Add to your vault
            </Text>
          </View>
        </View>

        {/* Server-stamp notice */}
        <View
          style={{
            backgroundColor: 'rgba(192, 145, 85, 0.10)',
            borderRadius: 12,
            padding: 12,
            gap: 6,
            borderWidth: 1,
            borderColor: 'rgba(192, 145, 85, 0.25)',
          }}
        >
          <VaultTrustBadge />
          <Text style={{ fontSize: 13, color: tokens.color.textPrimary, lineHeight: 19 }}>
            This will be timestamped at <Text style={{ fontWeight: '700' }}>{nowLabel}</Text> by the
            server. After you save, you won't be able to edit or delete it.
          </Text>
        </View>

        {/* Body */}
        <View
          style={{
            backgroundColor: tokens.color.bgPrimary,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: tokens.color.borderSubtle,
            padding: 14,
          }}
        >
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            placeholder={
              'What happened today? "Five mile run." "Day 30 sober." "Got the promotion. Calling Mom later."'
            }
            placeholderTextColor={tokens.color.textMuted}
            maxLength={MAX_LEN}
            autoFocus
            style={{
              minHeight: 200,
              fontSize: 16,
              lineHeight: 24,
              color: tokens.color.textPrimary,
              textAlignVertical: 'top',
            }}
          />
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 10,
              borderTopWidth: 1,
              borderTopColor: tokens.color.borderSubtle,
              paddingTop: 10,
            }}
          >
            <Pressable
              onPress={onAttachPhoto}
              disabled={attaching || saving}
              hitSlop={6}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                opacity: pressed || attaching ? 0.6 : 1,
              })}
            >
              {attaching ? (
                <ActivityIndicator size="small" color={tokens.color.accentPrimary} />
              ) : (
                <Text style={{ fontSize: 16 }}>📎</Text>
              )}
              <Text style={{ color: tokens.color.accentPrimary, fontSize: 13, fontWeight: '600' }}>
                {attaching
                  ? 'Uploading…'
                  : attachment
                    ? 'Replace photo'
                    : 'Attach photo'}
              </Text>
            </Pressable>
            <Text style={{ fontSize: 11, color: tokens.color.textMuted }}>
              {body.length} / {MAX_LEN}
            </Text>
          </View>
        </View>

        {attachment && (
          <View
            style={{
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: tokens.color.borderSubtle,
              padding: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Image
              source={{ uri: getPublicUrl(attachment) }}
              style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: tokens.color.bgTinted }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.color.textPrimary }}>
                Photo attached
              </Text>
              <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}>
                It will be stamped with the rest of this entry.
              </Text>
            </View>
            <Pressable onPress={onRemoveAttachment} hitSlop={8}>
              <Text style={{ color: tokens.color.accentPrimary, fontWeight: '700', fontSize: 13 }}>
                Remove
              </Text>
            </Pressable>
          </View>
        )}

        {error && (
          <Text style={{ color: tokens.color.danger, fontSize: 13 }}>
            {error}
          </Text>
        )}

        {/* Submit */}
        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => ({
            backgroundColor: canSubmit ? tokens.color.accentPrimary : tokens.color.borderStrong,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
            opacity: pressed && canSubmit ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              color: 'white',
              fontWeight: '700',
              fontSize: 16,
            }}
          >
            {saving ? 'Saving...' : 'Save to vault'}
          </Text>
        </Pressable>

        <Text
          style={{
            fontSize: 12,
            color: tokens.color.textMuted,
            textAlign: 'center',
            lineHeight: 18,
          }}
        >
          Nothing is shared yet. Releases happen on a separate screen, when you choose to.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
