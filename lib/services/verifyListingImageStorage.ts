import { listingStorageObjectPathFromUrl } from "@/lib/listing-media-src"
import { verifyStorageObjectExists } from "@/lib/supabase/storage-object-exists"

/**
 * Confirms the Supabase objects behind a listing photo row still exist.
 * Non–listings-bucket URLs (legacy imports, hotlinks) are skipped.
 */
export async function verifyListingImageObjectsExist(
  url: string,
  thumbnailUrl?: string | null,
): Promise<boolean> {
  const fullPath = listingStorageObjectPathFromUrl(url)
  if (!fullPath) return true

  if (!(await verifyStorageObjectExists("listings", fullPath))) {
    return false
  }

  const thumbPath =
    typeof thumbnailUrl === "string" && thumbnailUrl.trim()
      ? listingStorageObjectPathFromUrl(thumbnailUrl)
      : null
  if (!thumbPath || thumbPath === fullPath) {
    return true
  }

  return verifyStorageObjectExists("listings", thumbPath)
}

export async function assertListingImageObjectsExist(
  url: string,
  thumbnailUrl?: string | null,
): Promise<void> {
  const ok = await verifyListingImageObjectsExist(url, thumbnailUrl)
  if (!ok) {
    throw new Error("One or more photos are missing from storage. Upload them again.")
  }
}
