import type { SupabaseClient } from "@supabase/supabase-js"

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

  const { data, error } = await supabase
    .from("listing_images")
    .select("url, thumbnail_url")
    .in("listing_id", listingIds)

  if (error || !data?.length) return []

  const urls: string[] = []
  for (const row of data as { url?: string | null; thumbnail_url?: string | null }[]) {
    if (row.url?.trim()) urls.push(row.url)
    if (row.thumbnail_url?.trim()) urls.push(row.thumbnail_url)
  }
  return urls
}

const REMOVE_BATCH = 100

/**
 * Removes objects from the `listings` storage bucket. Call after the listing row
 * was deleted (URLs must have been read before delete). Ignores URLs that are not
 * in this bucket. Logs failures; does not throw.
 */
export async function removeListingImageFilesFromStorage(
  supabase: SupabaseClient,
  imagePublicUrls: string[],
): Promise<void> {
  const paths = bucketPathsFromListingImageUrls(imagePublicUrls)
  if (paths.length === 0) return

  for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
    const batch = paths.slice(i, i + REMOVE_BATCH)
    const { error } = await supabase.storage.from(BUCKET).remove(batch)
    if (error) {
      console.warn("[listingStorageCleanup] storage.remove failed:", error.message)
    }
  }
}
