import { listingStorageObjectPathFromUrl } from "@/lib/listing-media-src"
import { verifyListingImageObjectsExist } from "@/lib/services/verifyListingImageStorage"
import { getDb } from "@/lib/supabase/db"

export type ListingImageStorageDriftRow = {
  listingId: string
  imageId: string
  title: string | null
  status: string | null
  url: string
}

/**
 * Finds `listing_images` rows whose listings-bucket objects are missing.
 * Used by the drift cron and ops scripts.
 */
export async function scanListingImageStorageDrift(opts?: {
  /** Max rows to scan per run (newest listings first). Default 2000. */
  limit?: number
  activeListingsOnly?: boolean
}): Promise<{ scanned: number; missing: ListingImageStorageDriftRow[] }> {
  const limit = Math.min(Math.max(opts?.limit ?? 2000, 1), 10_000)
  const activeOnly = opts?.activeListingsOnly !== false

  const supabase = getDb()
  let query = supabase
    .from("listing_images")
    .select(
      "id, listing_id, url, listings!inner(title, status, updated_at)",
    )
    .order("listing_id", { ascending: false })
    .limit(limit)

  if (activeOnly) {
    query = query.eq("listings.status", "active")
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  const missing: ListingImageStorageDriftRow[] = []
  for (const row of data ?? []) {
    const url = typeof row.url === "string" ? row.url : ""
    if (!url.trim()) continue
    const path = listingStorageObjectPathFromUrl(url)
    if (!path) continue
    const ok = await verifyListingImageObjectsExist(url, null)
    if (ok) continue
    const listing = row.listings as { title?: string | null; status?: string | null } | null
    missing.push({
      listingId: String(row.listing_id),
      imageId: String(row.id),
      title: listing?.title ?? null,
      status: listing?.status ?? null,
      url,
    })
  }

  return { scanned: data?.length ?? 0, missing }
}
