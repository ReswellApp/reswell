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

  const thumbPath =
    typeof thumbnailUrl === "string" && thumbnailUrl.trim()
      ? listingStorageObjectPathFromUrl(thumbnailUrl)
      : null
  if (!thumbPath || thumbPath === fullPath) {
    return verifyStorageObjectExists("listings", fullPath)
  }

  const [fullOk, thumbOk] = await Promise.all([
    verifyStorageObjectExists("listings", fullPath),
    verifyStorageObjectExists("listings", thumbPath),
  ])
  return fullOk && thumbOk
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

export async function assertAllListingImageObjectsExist(
  images: ReadonlyArray<{ url: string; thumbnailUrl?: string | null }>,
): Promise<void> {
  await Promise.all(
    images.map(async (image) => {
      const url = image.url.trim()
      if (!url) return
      await assertListingImageObjectsExist(url, image.thumbnailUrl)
    }),
  )
}
