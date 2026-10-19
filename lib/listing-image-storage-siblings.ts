/**
 * Pair uploads store four objects for one photo: `*-full.*`, `*-thumb.*`,
 * `*-card2.*`, and `*-film2.*`. Only the full and thumb URLs are saved on
 * `listing_images`. Cleanup has to name the other two itself.
 */

const LISTING_IMAGE_ROLE_RE =
  /-(full|thumb|card2|film2|card|film)\.(webp|jpe?g)$/i

const LISTING_IMAGE_ROLES = ["full", "thumb", "card2", "film2", "card", "film"] as const

function listingImageUrlWithoutQuery(url: string): string {
  const trimmed = url.trim()
  const withoutHash = trimmed.split("#")[0] ?? trimmed
  return withoutHash.split("?")[0] ?? withoutHash
}

/** Full, thumb, card, and film URLs for every pair-upload photo in `urls`. */
export function listingImageSiblingPublicUrls(
  urls: Iterable<string | null | undefined>,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  const push = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    out.push(trimmed)
  }

  for (const raw of urls) {
    if (!raw?.trim()) continue
    const url = listingImageUrlWithoutQuery(raw)
    push(url)
    const match = LISTING_IMAGE_ROLE_RE.exec(url)
    if (!match) continue
    const ext = match[2]
    const stem = url.slice(0, match.index)
    for (const role of LISTING_IMAGE_ROLES) {
      push(`${stem}-${role}.${ext}`)
    }
  }

  return out
}

/**
 * Storage URLs to delete for removed photos, minus any object a photo that is
 * still on the listing still needs (including its card and film siblings).
 */
export function listingStorageUrlsToRemove(
  removedUrls: Iterable<string | null | undefined>,
  keepUrls?: Iterable<string | null | undefined>,
): string[] {
  const keep = new Set(listingImageSiblingPublicUrls(keepUrls ?? []))
  return listingImageSiblingPublicUrls(removedUrls).filter((url) => !keep.has(url))
}
