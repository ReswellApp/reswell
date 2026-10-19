import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidatePublicStorageObjects } from "@/lib/cache/revalidate-public-storage-object"
import { listingStorageUrlsToRemove } from "@/lib/listing-image-storage-siblings"
import { revalidateListingMediaVariantCaches } from "@/lib/media/listing-tile-variant-resize"

const BUCKET = "listings" as const
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`

/**
 * Parses a public object URL for the listings bucket into the path passed to
 * `storage.from("listings").remove([...])`.
 */
export function listingPublicMediaUrlToBucketPath(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  const withoutQuery = (trimmed.split("?")[0] ?? trimmed).trim()
  const i = withoutQuery.indexOf(PUBLIC_MARKER)
  if (i === -1) return null
  const encodedTail = withoutQuery.slice(i + PUBLIC_MARKER.length)
  if (!encodedTail) return null
  try {
    return encodedTail
      .split("/")
      .map((s) => decodeURIComponent(s))
      .join("/")
  } catch {
    return null
  }
}

export function bucketPathsFromListingImageUrls(
  urls: Iterable<string | null | undefined>,
): string[] {
  const out = new Set<string>()
  for (const u of urls) {
    if (!u?.trim()) continue
    const p = listingPublicMediaUrlToBucketPath(u)
    if (p) out.add(p)
  }
  return [...out]
}

export async function fetchListingImageUrlsForListingIds(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<string[]> {
  if (listingIds.length === 0) return []

  const [{ data: imageData, error: imageError }, { data: videoData, error: videoError }] =
    await Promise.all([
      supabase.from("listing_images").select("url, thumbnail_url").in("listing_id", listingIds),
      supabase.from("listing_videos").select("url, thumbnail_url").in("listing_id", listingIds),
    ])

  if (imageError) {
    console.warn("[listingStorageCleanup] listing_images fetch failed:", imageError.message)
  }
  if (videoError) {
    console.warn("[listingStorageCleanup] listing_videos fetch failed:", videoError.message)
  }

  const urls: string[] = []
  for (const row of (imageData ?? []) as { url?: string | null; thumbnail_url?: string | null }[]) {
    if (row.url?.trim()) urls.push(row.url)
    if (row.thumbnail_url?.trim()) urls.push(row.thumbnail_url)
  }
  for (const row of (videoData ?? []) as { url?: string | null; thumbnail_url?: string | null }[]) {
    if (row.url?.trim()) urls.push(row.url)
    if (row.thumbnail_url?.trim()) urls.push(row.thumbnail_url)
  }
  return urls
}

const REMOVE_BATCH = 100

/**
 * Removes objects from the `listings` storage bucket. Call only after the
 * `listing_images` / `listing_videos` rows are gone. Pair-upload photos also
 * drop their `card2` and `film2` siblings, which are not stored on the row.
 * URLs still used by a photo that remains on the listing are kept.
 * Ignores URLs that are not in this bucket. Logs failures; does not throw.
 */
export async function removeListingImageFilesFromStorage(
  supabase: SupabaseClient,
  imagePublicUrls: string[],
  keepUrls?: Iterable<string | null | undefined>,
): Promise<void> {
  const paths = bucketPathsFromListingImageUrls(
    listingStorageUrlsToRemove(imagePublicUrls, keepUrls),
  )
  if (paths.length === 0) return

  const removedPaths: string[] = []

  for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
    const batch = paths.slice(i, i + REMOVE_BATCH)
    const { error } = await supabase.storage.from(BUCKET).remove(batch)
    if (error) {
      console.warn("[listingStorageCleanup] storage.remove failed:", error.message)
    } else {
      removedPaths.push(...batch)
    }
  }

  if (removedPaths.length > 0) {
    revalidatePublicStorageObjects(BUCKET, removedPaths)
    revalidateListingMediaVariantCaches(BUCKET, removedPaths)
  }
}

type ListingMediaUrlTable = "listing_images" | "listing_videos"

type DeletedListingMediaRow = {
  url?: string | null
  thumbnail_url?: string | null
}

/**
 * Deletes media rows first, then their storage objects.
 *
 * Storage is not in the database transaction. Deleting the files first and then
 * failing the row delete (trigger, RLS, or a rolled-back statement) leaves the
 * listing pointing at objects that are already gone. The card and film siblings
 * were never in that delete list, so those copies survived and the thumb broke.
 */
export async function deleteListingMediaRowsThenStorage(
  supabase: SupabaseClient,
  table: ListingMediaUrlTable,
  listingId: string,
  rowIds: string[],
  keepUrls?: Iterable<string | null | undefined>,
): Promise<void> {
  const ids = [...new Set(rowIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return

  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq("listing_id", listingId)
    .in("id", ids)
    .select("url, thumbnail_url")

  if (error) {
    throw new Error(error.message)
  }

  const deleted = (data ?? []) as DeletedListingMediaRow[]
  if (deleted.length === 0) return

  const urls: string[] = []
  for (const row of deleted) {
    if (row.url?.trim()) urls.push(row.url.trim())
    if (row.thumbnail_url?.trim()) urls.push(row.thumbnail_url.trim())
  }
  if (urls.length === 0) return

  await removeListingImageFilesFromStorage(supabase, urls, keepUrls)
}
