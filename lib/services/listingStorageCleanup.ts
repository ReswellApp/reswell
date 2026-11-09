import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidatePublicStorageObjects } from "@/lib/cache/revalidate-public-storage-object"
import { listingImageUrlKey } from "@/lib/listing-image-identity"
import { listingStorageUrlsToRemove } from "@/lib/listing-image-storage-siblings"
import { revalidateListingMediaVariantCaches } from "@/lib/media/listing-tile-variant-resize"

const BUCKET = "listings" as const

type ListingMediaUrlTable = "listing_images" | "listing_videos"

type ListingMediaUrlRow = {
  url?: string | null
  thumbnail_url?: string | null
}

/**
 * Parses a public object URL for the listings bucket into the path passed to
 * `storage.from("listings").remove([...])`.
 *
 * Accepts Supabase public URLs and `/media/listings/...` (relative or absolute).
 */
export function listingPublicMediaUrlToBucketPath(url: string): string | null {
  const key = listingImageUrlKey(url)
  if (!key || key.includes("://") || key.includes("..") || key.startsWith("/")) {
    return null
  }
  return key
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

function pushListingMediaUrls(urls: string[], row: ListingMediaUrlRow): void {
  if (row.url?.trim()) urls.push(row.url.trim())
  if (row.thumbnail_url?.trim()) urls.push(row.thumbnail_url.trim())
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
  for (const row of (imageData ?? []) as ListingMediaUrlRow[]) {
    pushListingMediaUrls(urls, row)
  }
  for (const row of (videoData ?? []) as ListingMediaUrlRow[]) {
    pushListingMediaUrls(urls, row)
  }
  return urls
}

async function fetchRemainingListingMediaUrls(
  supabase: SupabaseClient,
  table: ListingMediaUrlTable,
  listingId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from(table)
    .select("url, thumbnail_url")
    .eq("listing_id", listingId)

  if (error) {
    console.warn(
      `[listingStorageCleanup] remaining ${table} fetch failed:`,
      error.message,
    )
    return []
  }

  const urls: string[] = []
  for (const row of (data ?? []) as ListingMediaUrlRow[]) {
    pushListingMediaUrls(urls, row)
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

/**
 * Deletes media rows first, then their storage objects.
 *
 * Storage is not in the database transaction. Deleting the files first and then
 * failing the row delete (trigger, RLS, or a rolled-back statement) leaves the
 * listing pointing at objects that are already gone. The card and film siblings
 * were never in that delete list, so those copies survived and the thumb broke.
 *
 * After the row delete, remaining rows on the listing are always treated as
 * keep URLs — so a stale or differently-formatted client keep list cannot wipe
 * files another photo row still needs.
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

  const deleted = (data ?? []) as ListingMediaUrlRow[]
  if (deleted.length === 0) return

  const urls: string[] = []
  for (const row of deleted) {
    pushListingMediaUrls(urls, row)
  }
  if (urls.length === 0) return

  const remainingUrls = await fetchRemainingListingMediaUrls(supabase, table, listingId)
  const mergedKeep = [...(keepUrls ?? []), ...remainingUrls]

  await removeListingImageFilesFromStorage(supabase, urls, mergedKeep)
}
