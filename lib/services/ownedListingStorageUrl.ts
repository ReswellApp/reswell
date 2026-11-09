import { listingStorageObjectPathFromUrl } from "@/lib/listing-media-src"
import { listingObjectPublicUrl } from "@/lib/supabase/storage-upload-xhr"

/** True when the URL is a public `listings` object under this seller's folder. */
export function isOwnedListingStorageUrl(url: string, userId: string): boolean {
  const path = listingStorageObjectPathFromUrl(url)
  if (path) {
    let decoded = path
    try {
      decoded = decodeURIComponent(path)
    } catch {
      decoded = path
    }
    return decoded === userId || decoded.startsWith(`${userId}/`)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  if (!supabaseUrl) return false
  return url.startsWith(listingObjectPublicUrl(supabaseUrl, `${userId}/`))
}
