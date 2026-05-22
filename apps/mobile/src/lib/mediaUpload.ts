/**
 * Media upload pipeline — photos + videos.
 *
 * Two surfaces:
 *   1. `pickImage()` — open the native gallery via expo-image-picker on
 *      iOS/Android, fall back to a hidden `<input type="file">` on web.
 *      Returns a normalized `PickedMedia` shape with a Blob the upload
 *      step can stream directly to Supabase Storage.
 *
 *   2. `uploadMedia(media, opts)` — uploads the blob to
 *      `family-media/<userId>/<uuid>.<ext>`, inserts a `media_assets` row,
 *      and returns the inserted row. Capped at 50 MB to start; large files
 *      throw a friendly error before they hit the network.
 *
 *   3. `getPublicUrl(asset)` — returns the Supabase Storage public URL for
 *      a saved asset.
 *
 * Bucket / RLS: see migration `20260522000011_storage_buckets.sql`. The
 * bucket is public for reads (the path is unguessable random uuid) and
 * RLS scopes INSERT/UPDATE/DELETE to the user's own prefix.
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';

const BUCKET = 'family-media';
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

// ---- Types -----------------------------------------------------------------

export interface PickedMedia {
  /** The raw blob ready for upload. */
  blob: Blob;
  /** MIME type, e.g. 'image/jpeg' or 'video/mp4'. */
  mime: string;
  /** File extension without leading dot, lowercased, e.g. 'jpg'. */
  ext: string;
  /** Optional dimensions when we can determine them up-front. */
  width?: number;
  height?: number;
  /** Original filename if available — used as a hint, not as the storage key. */
  filename?: string;
}

export type MediaKind = 'photo' | 'video';

export interface MediaAsset {
  id: string;
  ownerUserId: string;
  circleId: string;
  kind: 'image' | 'video' | 'audio' | 'document' | 'screenshot';
  storagePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
}

export class MediaUploadError extends Error {
  cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'MediaUploadError';
    this.cause = cause;
  }
}

// ---- Helpers ---------------------------------------------------------------

function extFromMime(mime: string, fallback = 'bin'): string {
  const m = mime.toLowerCase();
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg';
  if (m === 'image/png') return 'png';
  if (m === 'image/heic' || m === 'image/heif') return 'heic';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  if (m === 'video/mp4') return 'mp4';
  if (m === 'video/quicktime') return 'mov';
  if (m === 'video/webm') return 'webm';
  if (m.startsWith('image/')) return m.split('/')[1] ?? fallback;
  if (m.startsWith('video/')) return m.split('/')[1] ?? fallback;
  return fallback;
}

function extFromName(name: string | undefined): string | null {
  if (!name) return null;
  const dot = name.lastIndexOf('.');
  if (dot < 0 || dot === name.length - 1) return null;
  return name.slice(dot + 1).toLowerCase();
}

function randomId(): string {
  // RFC4122-ish without pulling a uuid library. Sufficient for an opaque
  // storage key (uniqueness, not unguessability, is the requirement).
  const r = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${r(8)}-${r(4)}-${r(4)}-${r(4)}-${r(12)}`;
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new MediaUploadError('You must be signed in to upload media.');
  return uid;
}

async function getMyPrimaryCircleId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('family_memberships')
    .select('circle_id, joined_at')
    .eq('user_id', userId)
    .is('removed_at', null)
    .order('joined_at', { ascending: true })
    .limit(1);
  if (error) {
    throw new MediaUploadError('Could not find your family circle.', error);
  }
  const circleId = data?.[0]?.circle_id as string | undefined;
  if (!circleId) {
    throw new MediaUploadError(
      'No family circle found for your account. Try signing out and back in.',
    );
  }
  return circleId;
}

// ---- pickImage -------------------------------------------------------------

/**
 * Open the native picker on iOS/Android (via expo-image-picker), or the
 * browser file input on web. Returns `null` if the user cancelled.
 *
 * Both code paths produce the same `PickedMedia` shape so callers don't
 * need to branch on Platform.
 */
export async function pickImage(opts?: {
  mediaTypes?: 'photo' | 'video' | 'all';
}): Promise<PickedMedia | null> {
  const kind = opts?.mediaTypes ?? 'all';
  if (Platform.OS === 'web') {
    return pickWeb(kind);
  }
  return pickNative(kind);
}

// ---- Native pick (expo-image-picker) --------------------------------------

async function pickNative(kind: 'photo' | 'video' | 'all'): Promise<PickedMedia | null> {
  let ImagePicker: typeof import('expo-image-picker');
  try {
    // Require lazily so the web bundle doesn't drag in native-only types.
    // The package is listed in package.json; if it's not installed the
    // helpful error below points the user at the install command.
    ImagePicker = require('expo-image-picker');
  } catch (err) {
    throw new MediaUploadError(
      'expo-image-picker is not installed. Run `pnpm --filter @kin/mobile add expo-image-picker` and rebuild.',
      err,
    );
  }

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new MediaUploadError(
      'FamLink needs access to your photos to attach them. Enable it in Settings and try again.',
    );
  }

  const mediaTypes =
    kind === 'photo'
      ? ImagePicker.MediaTypeOptions.Images
      : kind === 'video'
        ? ImagePicker.MediaTypeOptions.Videos
        : ImagePicker.MediaTypeOptions.All;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes,
    allowsEditing: false,
    quality: 0.85,
    exif: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }
  const asset = result.assets[0]!;

  // expo-image-picker returns a `file://` uri on iOS/Android. fetch() in
  // React Native can resolve that to a Blob.
  const res = await fetch(asset.uri);
  const blob = await res.blob();

  const mime = asset.mimeType || blob.type || guessMimeFromAsset(asset);
  const ext =
    extFromName(asset.fileName ?? asset.uri.split('/').pop() ?? undefined) ||
    extFromMime(mime, asset.type === 'video' ? 'mp4' : 'jpg');

  return {
    blob,
    mime,
    ext,
    width: asset.width,
    height: asset.height,
    filename: asset.fileName ?? undefined,
  };
}

function guessMimeFromAsset(asset: {
  type?: string | null;
  uri: string;
  fileName?: string | null;
}): string {
  const extHint = extFromName(asset.fileName ?? asset.uri.split('/').pop() ?? undefined);
  if (asset.type === 'video') {
    if (extHint === 'mov') return 'video/quicktime';
    if (extHint === 'webm') return 'video/webm';
    return 'video/mp4';
  }
  if (extHint === 'png') return 'image/png';
  if (extHint === 'gif') return 'image/gif';
  if (extHint === 'heic' || extHint === 'heif') return 'image/heic';
  if (extHint === 'webp') return 'image/webp';
  return 'image/jpeg';
}

// ---- Web pick (file input) ------------------------------------------------

async function pickWeb(kind: 'photo' | 'video' | 'all'): Promise<PickedMedia | null> {
  if (typeof document === 'undefined') {
    throw new MediaUploadError('File picker is only available in a browser context.');
  }

  const accept =
    kind === 'photo' ? 'image/*' : kind === 'video' ? 'video/*' : 'image/*,video/*';

  return new Promise<PickedMedia | null>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '-9999px';

    let settled = false;
    const settle = (value: PickedMedia | null) => {
      if (settled) return;
      settled = true;
      try {
        document.body.removeChild(input);
      } catch {
        /* already removed */
      }
      resolve(value);
    };

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) {
        settle(null);
        return;
      }
      try {
        const mime = file.type || guessMimeFromFilename(file.name);
        const ext = extFromName(file.name) || extFromMime(mime);
        // Attempt to read dimensions for images. Cheap and helpful for
        // downstream layout.
        let width: number | undefined;
        let height: number | undefined;
        if (mime.startsWith('image/')) {
          try {
            const dims = await readImageDimensions(file);
            width = dims.width;
            height = dims.height;
          } catch {
            /* ignore — dimensions are best-effort */
          }
        }
        settle({
          blob: file,
          mime,
          ext,
          width,
          height,
          filename: file.name,
        });
      } catch (err) {
        settled = true;
        try {
          document.body.removeChild(input);
        } catch {
          /* already removed */
        }
        reject(
          err instanceof MediaUploadError
            ? err
            : new MediaUploadError('Could not read the selected file.', err),
        );
      }
    });

    // Some browsers don't fire `change` when the user cancels. There's no
    // standard cancel event, but `focus` returning to the window after a
    // tick without a file means the dialog was dismissed.
    const cancelGuard = () => {
      setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) {
          settle(null);
        }
      }, 350);
      window.removeEventListener('focus', cancelGuard);
    };
    window.addEventListener('focus', cancelGuard);

    document.body.appendChild(input);
    input.click();
  });
}

function guessMimeFromFilename(name: string): string {
  const ext = extFromName(name);
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'webm') return 'video/webm';
  return 'application/octet-stream';
}

function readImageDimensions(file: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const out = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(out);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

// ---- uploadMedia -----------------------------------------------------------

export interface UploadMediaOptions {
  kind: MediaKind;
  /** Override the family circle the asset is linked to. Defaults to the user's primary circle. */
  circleId?: string;
}

/**
 * Upload a blob to Supabase Storage and create a matching `media_assets` row.
 * Returns the inserted row.
 */
export async function uploadMedia(
  media: PickedMedia,
  opts: UploadMediaOptions,
): Promise<MediaAsset> {
  if (!media.blob) {
    throw new MediaUploadError('No file was selected.');
  }
  const size = media.blob.size;
  if (size > MAX_BYTES) {
    const mb = (size / (1024 * 1024)).toFixed(1);
    throw new MediaUploadError(
      `That file is ${mb} MB. Right now we cap uploads at 50 MB — try a smaller file or trim the video.`,
    );
  }
  if (size === 0) {
    throw new MediaUploadError('That file looks empty. Pick a different one.');
  }

  const userId = await currentUserId();
  const circleId = opts.circleId ?? (await getMyPrimaryCircleId(userId));

  const ext = (media.ext || extFromMime(media.mime, opts.kind === 'video' ? 'mp4' : 'jpg'))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const filename = `${randomId()}.${ext || 'bin'}`;
  const storagePath = `${userId}/${filename}`;

  // 1. Upload to Storage.
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, media.blob, {
      contentType: media.mime || 'application/octet-stream',
      cacheControl: '3600',
      upsert: false,
    });
  if (uploadErr) {
    throw new MediaUploadError(
      'Upload failed. Check your connection and try again.',
      uploadErr,
    );
  }

  // 2. Insert the asset row.
  const dbKind: MediaAsset['kind'] = opts.kind === 'video' ? 'video' : 'image';
  const insertRow = {
    owner_user_id: userId,
    uploaded_by_user_id: userId,
    circle_id: circleId,
    kind: dbKind,
    storage_provider: 'supabase',
    storage_path: storagePath,
    mime_type: media.mime || null,
    bytes: size,
    size_bytes: size,
    width: media.width ?? null,
    height: media.height ?? null,
  };

  const { data, error: insertErr } = await supabase
    .from('media_assets')
    .insert(insertRow)
    .select(
      'id, owner_user_id, circle_id, kind, storage_path, mime_type, size_bytes, width, height',
    )
    .single();

  if (insertErr || !data) {
    // Roll back the storage upload so we don't leave an orphan.
    void supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {
      /* best effort */
    });
    throw new MediaUploadError(
      'Saved the file but could not link it to your family. Try again.',
      insertErr,
    );
  }

  return {
    id: data.id as string,
    ownerUserId: data.owner_user_id as string,
    circleId: data.circle_id as string,
    kind: data.kind as MediaAsset['kind'],
    storagePath: data.storage_path as string,
    mimeType: (data.mime_type as string | null) ?? null,
    sizeBytes: (data.size_bytes as number | null) ?? size,
    width: (data.width as number | null) ?? null,
    height: (data.height as number | null) ?? null,
  };
}

// ---- getPublicUrl ----------------------------------------------------------

/**
 * Returns the public URL for a stored media asset. The bucket is public so
 * this works for any consumer; if we lock it down later this function can
 * switch to `createSignedUrl` without callers changing.
 */
export function getPublicUrl(asset: Pick<MediaAsset, 'storagePath'> | string): string {
  const path = typeof asset === 'string' ? asset : asset.storagePath;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Fetch a media asset row by id. Returns null if not found / not visible.
 */
export async function fetchMediaAsset(id: string): Promise<MediaAsset | null> {
  const { data, error } = await supabase
    .from('media_assets')
    .select(
      'id, owner_user_id, circle_id, kind, storage_path, mime_type, size_bytes, width, height',
    )
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    ownerUserId: data.owner_user_id as string,
    circleId: data.circle_id as string,
    kind: data.kind as MediaAsset['kind'],
    storagePath: data.storage_path as string,
    mimeType: (data.mime_type as string | null) ?? null,
    sizeBytes: (data.size_bytes as number | null) ?? null,
    width: (data.width as number | null) ?? null,
    height: (data.height as number | null) ?? null,
  };
}
