import { klaviyoMediaListingPhotoUrl } from "@/lib/klaviyo/catalog-product"
import {
  boardAlertPhotoCandidateUrls,
  chooseReachableListingPhotoUrl,
  listingPhotoProbeResult,
  type ListingPhotoProbeResult,
} from "@/lib/klaviyo/reachable-listing-photo"
import { listingDirectPublicImageUrl } from "@/lib/listing-media-proxy-url"

const PROBE_TIMEOUT_MS = 4_000

async function probeListingPhoto(
  rawUrl: string,
  fetchImpl: typeof fetch,
): Promise<{ url: string; result: ListingPhotoProbeResult } | null> {
  const direct = listingDirectPublicImageUrl(rawUrl)
  const media = klaviyoMediaListingPhotoUrl(rawUrl)
  // Shopify and other outside hosts are not emailed. A storage path, or a
  // `/media/listings` link that points at one, is.
  if (!direct && !media) return null

  const probeTarget = direct ?? media
  try {
    const res = await fetchImpl(probeTarget, {
      method: "HEAD",
      headers: { Accept: "image/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    return { url: rawUrl, result: listingPhotoProbeResult(res.status) }
  } catch {
    return { url: rawUrl, result: "unknown" }
  }
}

/**
 * Email photo for a listing, or null when every stored file is missing.
 * Checks the full image first, then the thumbnail.
 */
export async function resolveBoardAlertPhotoUrl(
  url: string | null | undefined,
  thumbnailUrl: string | null | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const checks = []
  for (const candidate of boardAlertPhotoCandidateUrls(url, thumbnailUrl)) {
    const check = await probeListingPhoto(candidate, fetchImpl)
    if (check) checks.push(check)
  }
  return chooseReachableListingPhotoUrl(checks)
}
