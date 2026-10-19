/**
 * Pair uploads store four objects for one photo: `*-full.*`, `*-thumb.*`,
 * `*-card2.*`, and `*-film2.*`. Only the full and thumb URLs are saved on
 * `listing_images`. Cleanup has to name the other two itself.
 */

const LISTING_IMAGE_ROLE_RE =
  /-(full|thumb|card2|film2|card|film)\.(webp|jpe?g)$/i

const LISTING_IMAGE_ROLES = ["full", "thumb", "card2", "film2", "card", "film"] as const

/** Closest surviving size first. Card is sharper than film when the thumb is gone. */
const LISTING_IMAGE_STAND_INS: Record<"full" | "thumb", readonly string[]> = {
  full: ["card2", "film2", "card", "film"],
  thumb: ["film2", "card2", "film", "card"],
}

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

/**
 * Object keys to try when `*-full.*` or `*-thumb.*` is already gone.
 * Pair uploads leave `*-card2.*` and `*-film2.*` beside them; those files are
 * enough to show the photo on receipts, carts, and the product page.
 */
export function listingImageStandInObjectPaths(objectPath: string): string[] {
  const path = objectPath.trim()
  const match = /-(full|thumb)\.(webp|jpe?g)$/i.exec(path)
  if (!match?.[1] || !match[2]) return []

  const role = match[1].toLowerCase() as "full" | "thumb"
  const currentExt = `.${match[2].toLowerCase()}`
  const stem = path.slice(0, match.index)
  const extensions = [currentExt]
  for (const ext of [".webp", ".jpg"]) {
    if (ext !== currentExt) extensions.push(ext)
  }

  const out: string[] = []
  for (const standInRole of LISTING_IMAGE_STAND_INS[role]) {
    for (const ext of extensions) {
      out.push(`${stem}-${standInRole}${ext}`)
    }
  }
  return out
}
