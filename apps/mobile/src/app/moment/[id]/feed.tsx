import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, Image, ScrollView, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../../theme/tokens';
import { useEvent } from '../../../lib/eventStore';
import {
  addEventMediaRow,
  fetchEventMedia,
  getCachedDisplayName,
  userIdToMemberId,
  type EventMediaRow,
} from '../../../lib/supabaseEvents';
import { Avatar } from '../../../components/Avatar';
import { comingSoon } from '../../../lib/comingSoon';
import {
  getPublicUrl,
  pickImage,
  uploadMedia,
  MediaUploadError,
} from '../../../lib/mediaUpload';

export default function EventFeed() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const event = useEvent(id ?? '');
  const eventId = event?.id ?? id ?? '';
  const [media, setMedia] = useState<EventMediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const rows = await fetchEventMedia(eventId);
      setMedia(rows);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[event/feed] fetchEventMedia failed:', e);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onPickAndUpload(kind: 'photo' | 'video') {
    if (!eventId || uploading) return;
    setError(null);
    setUploading(true);
    try {
      const picked = await pickImage({ mediaTypes: kind });
      if (!picked) {
        setUploading(false);
        return;
      }
      const asset = await uploadMedia(picked, { kind });
      await addEventMediaRow({ eventId, mediaAssetId: asset.id });
      await refresh();
    } catch (e) {
      setError(
        e instanceof MediaUploadError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Couldn't share that media.",
      );
    } finally {
      setUploading(false);
    }
  }

  if (!event) return null;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 120,
          gap: 18,
        }}
      >
        <Header title="Photos & videos" subtitle={event.title} />

        {/* Post a memory CTA */}
        <Pressable
          onPress={() => onPickAndUpload('photo')}
          disabled={uploading}
          style={({ pressed }) => ({
            backgroundColor: tokens.color.accentPrimary,
            borderRadius: 18,
            padding: 18,
            gap: 6,
            opacity: pressed || uploading ? 0.85 : 1,
            flexDirection: 'row',
            alignItems: 'center',
          })}
        >
          {uploading && <ActivityIndicator color="white" />}
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
              {uploading ? 'Uploading…' : '+ Share a photo or video'}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 19 }}>
              Anything you share here is scoped to {event.title}. It also lands in the highlight reel
              we stitch together at the end.
            </Text>
          </View>
        </Pressable>

        {/* Secondary: video */}
        <Pressable
          onPress={() => onPickAndUpload('video')}
          disabled={uploading}
          style={({ pressed }) => ({
            backgroundColor: tokens.color.bgPrimary,
            borderWidth: 1,
            borderColor: tokens.color.borderSubtle,
            borderRadius: 14,
            paddingVertical: 12,
            paddingHorizontal: 16,
            opacity: pressed || uploading ? 0.75 : 1,
            alignItems: 'center',
          })}
        >
          <Text style={{ color: tokens.color.accentPrimary, fontWeight: '700', fontSize: 14 }}>
            🎬 Share a video instead
          </Text>
        </Pressable>

        {error && (
          <View
            style={{
              backgroundColor: '#FFEDED',
              borderRadius: 12,
              padding: 12,
            }}
          >
            <Text style={{ color: tokens.color.danger, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {/* Face auto-tag teaser — coming soon, sells the vision */}
        <Pressable
          onPress={() => comingSoon('face_autotag')}
          style={({ pressed }) => ({
            backgroundColor: tokens.color.bgPrimary,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: tokens.color.accentSecondary,
            borderRadius: 16,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
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
            <Text style={{ fontSize: 20 }}>✨</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.color.textPrimary }}>
                Auto-tag who's in each photo
              </Text>
              <View
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  backgroundColor: tokens.color.bgTinted,
                  borderRadius: 4,
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: '700', color: tokens.color.accentPrimary }}>
                  COMING SOON
                </Text>
              </View>
            </View>
            <Text
              style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 3, lineHeight: 17 }}
            >
              When photos and videos roll in during {event.title}, FamLink will auto-tag your family
              members in each one.
            </Text>
          </View>
        </Pressable>

        {/* Feed */}
        {event.photos.length === 0 ? (
          <View
            style={{
              backgroundColor: tokens.color.bgTinted,
              padding: 24,
              borderRadius: 18,
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}>
              Nothing here yet
            </Text>
            <Text style={{ fontSize: 14, color: tokens.color.textSecondary, lineHeight: 20 }}>
              Photos and videos from {event.title} will live here. They auto-collect into everyone's
              highlight reel at the end.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {event.photos.map((p) => (
              <PhotoCard key={p.id} photo={p} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function PhotoCard({ photo }: { photo: EventPhoto }) {
  const author = getAnyMember(photo.authorId);
  return (
    <View
      style={{
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
      }}
    >
      {/* Image stand-in */}
      <View
        style={{
          aspectRatio: 4 / 3,
          backgroundColor: photo.tint,
          justifyContent: 'flex-end',
          padding: 14,
        }}
      >
        {photo.mediaKind === 'video' && (
          <View
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              paddingHorizontal: 10,
              paddingVertical: 5,
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius: 999,
            }}
          >
            <Text style={{ fontSize: 11, color: 'white', fontWeight: '700' }}>
              ▶︎ {photo.durationSec ? `${photo.durationSec}s` : 'VIDEO'}
            </Text>
          </View>
        )}
      </View>
      <View style={{ padding: 14, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar member={author} size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.color.textPrimary }}>
              {author.name}
            </Text>
            <Text style={{ fontSize: 12, color: tokens.color.textMuted }}>{photo.whenAgo}</Text>
          </View>
          <Pressable
            onPress={() => {}}
            style={({ pressed }) => ({
              paddingHorizontal: 10,
              paddingVertical: 6,
              backgroundColor: tokens.color.bgTinted,
              borderRadius: 999,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontSize: 12, color: tokens.color.accentPrimary, fontWeight: '700' }}>
              ❤︎ {photo.reactions}
            </Text>
          </Pressable>
        </View>
        {photo.caption && (
          <Text style={{ fontSize: 15, color: tokens.color.textPrimary, lineHeight: 21 }}>
            {photo.caption}
          </Text>
        )}
      </View>
    </View>
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
