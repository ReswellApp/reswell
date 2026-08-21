const LISTING_OWNER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function listingMediaObjectSegments(path: string): [string, string] | null {
  const segments = path.split("/").filter(Boolean)
  if (segments.length !== 2) return null
  if (segments.some((s) => s.includes(".."))) return null
  const [userId, file] = segments
  if (!userId || !file) return null
  if (!LISTING_OWNER_UUID_RE.test(userId)) return null
  return [userId, file]
}

/**
 * Validates object keys for the listing media proxy (defense-in-depth; must match
 * upload naming from {@link uploadListingImagePairToSupabase}).
 */
export function isValidListingMediaObjectPath(path: string): boolean {
  const segments = listingMediaObjectSegments(path)
  if (!segments) return false
  return /^[a-zA-Z0-9._-]+\.(webp|jpe?g)$/i.test(segments[1])
}

/** Listing bucket video keys from {@link uploadListingVideoToSupabase}. */
export function isValidListingVideoObjectPath(path: string): boolean {
  const segments = listingMediaObjectSegments(path)
  if (!segments) return false
  return /^[a-zA-Z0-9._-]+\.(mp4|mov|webm)$/i.test(segments[1])
}
