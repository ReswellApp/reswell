/**
 * Which listing photo Board Alert Match may put in an email.
 * A `/media/listings/...` link is rewritten to Supabase. If that object is
 * missing, the browser shows `{"code":"NoSuchKey"}`. Skip those URLs.
 */

const NON_PHOTO_EXTENSION = /\.(?:mp4|mov|webm|m4v)(?:[?#]|$)/i

export type ListingPhotoProbeResult = "hit" | "miss" | "unknown"

export function boardAlertPhotoCandidateUrls(
  url: string | null | undefined,
  thumbnailUrl: string | null | undefined,
): string[] {
  const full = url?.trim() ?? ""
  const thumb = thumbnailUrl?.trim() ?? ""
  const out: string[] = []
  if (full && !NON_PHOTO_EXTENSION.test(full)) out.push(full)
  if (thumb && thumb !== full && !NON_PHOTO_EXTENSION.test(thumb)) out.push(thumb)
  return out
}

/** Supabase answers a missing object with 400 or 404 and `NoSuchKey`. */
export function listingPhotoProbeResult(status: number): ListingPhotoProbeResult {
  if (status === 400 || status === 404) return "miss"
  if (status >= 200 && status < 400) return "hit"
  return "unknown"
}

/**
 * First photo that exists. If every check failed open (network, 5xx), keep the
 * first of those so a blip does not strip a real photo. All confirmed misses
 * return null.
 */
export function chooseReachableListingPhotoUrl(
  checks: Array<{ url: string; result: ListingPhotoProbeResult }>,
): string | null {
  const hit = checks.find((check) => check.result === "hit" && check.url.trim())
  if (hit) return hit.url
  const unknown = checks.find((check) => check.result === "unknown" && check.url.trim())
  return unknown?.url ?? null
}
