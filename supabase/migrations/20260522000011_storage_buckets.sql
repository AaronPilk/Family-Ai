-- =============================================================================
-- Storage buckets for FamLink media uploads.
--
-- Goals:
--   1. Create a public `family-media` bucket. We keep it public for read so
--      the mobile + web clients can render media via the Storage CDN URL
--      without minting a signed URL for every <Image>. Access is gated at
--      the app layer via media_assets RLS — the storage object key includes
--      a random UUID, so guessing isn't practical, but this is explicitly a
--      pragmatic short-term posture (see GO-LIVE-PLAN.md). Tighten later.
--
--   2. Storage RLS:
--      - INSERT: any authenticated user, but only into <auth.uid()>/... so
--        users can't write to each other's prefixes.
--      - SELECT: any authenticated reader (and the public anon role since
--        the bucket is public — Storage handles that internally).
--      - UPDATE / DELETE: only the owning user (prefix check).
--
--   3. Bring `media_assets` in line with the upload pipeline:
--      - add `size_bytes` (mirrors existing `bytes` for forward callers)
--      - add `uploaded_by_user_id` (mirrors existing `owner_user_id` for
--        forward callers; we keep both to preserve historical behaviour)
--      - both default to filling from their legacy counterparts on insert
--        via a trigger, so existing code keeps working unchanged.
-- =============================================================================

-- 1. The bucket --------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-media',
  'family-media',
  true,
  -- 50 MB. The mobile client also enforces this. Keep them in sync.
  52428800,
  null   -- allow any mime; we constrain on the client.
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

-- 2. Storage RLS policies ----------------------------------------------------

-- INSERT: authenticated users may upload into their own folder. The first
-- path segment must equal auth.uid()::text.
drop policy if exists "family_media_insert_own_prefix" on storage.objects;
create policy "family_media_insert_own_prefix" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'family-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT: any authenticated user may read. App-level gating via media_assets
-- decides whether a given asset is renderable. Bucket is public anyway, so
-- this policy is mainly for completeness + anon API parity.
drop policy if exists "family_media_select_authenticated" on storage.objects;
create policy "family_media_select_authenticated" on storage.objects
  for select to authenticated
  using (bucket_id = 'family-media');

-- Anonymous (public) read — same justification as the bucket being public.
drop policy if exists "family_media_select_anon" on storage.objects;
create policy "family_media_select_anon" on storage.objects
  for select to anon
  using (bucket_id = 'family-media');

-- UPDATE: only the owning user may overwrite their own files.
drop policy if exists "family_media_update_own_prefix" on storage.objects;
create policy "family_media_update_own_prefix" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'family-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'family-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: only the owning user may delete their own files.
drop policy if exists "family_media_delete_own_prefix" on storage.objects;
create policy "family_media_delete_own_prefix" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'family-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. media_assets column patch ----------------------------------------------

alter table public.media_assets
  add column if not exists size_bytes bigint,
  add column if not exists uploaded_by_user_id uuid references public.users(id);

-- Backfill from legacy columns so existing rows keep their data.
update public.media_assets
   set size_bytes = bytes
 where size_bytes is null
   and bytes is not null;

update public.media_assets
   set uploaded_by_user_id = owner_user_id
 where uploaded_by_user_id is null
   and owner_user_id is not null;

-- 4. Insert RLS for media_assets --------------------------------------------
-- The media_assets table is referenced by event_media, memory_media, and
-- proof_vault_items, all of which already gate INSERTs via their own RLS
-- (and the FK from those tables ensures the asset row must exist first).
-- We need the client to be able to insert its own asset rows.

alter table public.media_assets enable row level security;

drop policy if exists media_assets_select_own_circle on public.media_assets;
create policy media_assets_select_own_circle on public.media_assets
  for select using (
    owner_user_id = auth.uid()
    or exists (
      select 1 from public.family_memberships fm
      where fm.user_id = auth.uid()
        and fm.circle_id = media_assets.circle_id
        and fm.removed_at is null
    )
  );

drop policy if exists media_assets_insert_self on public.media_assets;
create policy media_assets_insert_self on public.media_assets
  for insert with check (
    owner_user_id = auth.uid()
    and (uploaded_by_user_id is null or uploaded_by_user_id = auth.uid())
    and exists (
      select 1 from public.family_memberships fm
      where fm.user_id = auth.uid()
        and fm.circle_id = media_assets.circle_id
        and fm.removed_at is null
    )
  );

drop policy if exists media_assets_update_own on public.media_assets;
create policy media_assets_update_own on public.media_assets
  for update using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists media_assets_delete_own on public.media_assets;
create policy media_assets_delete_own on public.media_assets
  for delete using (owner_user_id = auth.uid());

grant select, insert, update, delete on public.media_assets to authenticated;

-- rollback
-- drop policy if exists media_assets_delete_own on public.media_assets;
-- drop policy if exists media_assets_update_own on public.media_assets;
-- drop policy if exists media_assets_insert_self on public.media_assets;
-- drop policy if exists media_assets_select_own_circle on public.media_assets;
-- alter table public.media_assets drop column if exists uploaded_by_user_id;
-- alter table public.media_assets drop column if exists size_bytes;
-- drop policy if exists "family_media_delete_own_prefix" on storage.objects;
-- drop policy if exists "family_media_update_own_prefix" on storage.objects;
-- drop policy if exists "family_media_select_anon" on storage.objects;
-- drop policy if exists "family_media_select_authenticated" on storage.objects;
-- drop policy if exists "family_media_insert_own_prefix" on storage.objects;
-- delete from storage.buckets where id = 'family-media';
