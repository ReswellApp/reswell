import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getActiveSurfboardListingPhotos } from "@/lib/db/sell-photo-listing-images"
import {
  listingStorageObjectPathFromUrl,
  listingStoredDerivativeUrl,
} from "@/lib/listing-media-src"
import { SELL_PHOTO_MATCH_LISTING_IMAGE_LIMIT, sniffSellPhotoMatchMime } from "@/lib/sell-flow/sell-photo-match"
import { matchSellListingPhotos, type SellPhotoMatchImage } from "@/lib/services/sellPhotoMatch"
import type { SellPhotoMatchResponse, SellPhotoLiveListing } from "@/lib/types/sell-photo-match"

const FETCH_CAP_BYTES = 2_500_000

export type SellListingPhotoMatchOutcome =
  | { ok: true; data: SellPhotoMatchResponse; listing: SellPhotoLiveListing }
  | { ok: false; error: string; status: 404 | 422 | 503 }

function fetchTargets(url: string): string[] {
  const targets: string[] = []
  const card = listingStoredDerivativeUrl(url, "card")
  if (card && listingStorageObjectPathFromUrl(card)) targets.push(card)
  if (listingStorageObjectPathFromUrl(url) && !targets.includes(url)) targets.push(url)
  return targets
}

async function readListingImage(url: string): Promise<SellPhotoMatchImage | null> {
  for (const target of fetchTargets(url)) {
    try {
      const res = await fetch(target, {
        redirect: "manual",
        signal: AbortSignal.timeout(12_000),
      })
      if (!res.ok) continue
      const declared = Number(res.headers.get("content-length") ?? "0")
      if (Number.isFinite(declared) && declared > FETCH_CAP_BYTES) continue
      const bytes = new Uint8Array(await res.arrayBuffer())
      if (bytes.byteLength < 1 || bytes.byteLength > FETCH_CAP_BYTES) continue
      const mediaType = sniffSellPhotoMatchMime(bytes)
      if (!mediaType) continue
      return { bytes, mediaType }
    } catch (err) {
      console.error(
        "[sellListingPhotoMatch] image fetch failed:",
        err instanceof Error ? err.message : err,
      )
    }
  }
  return null
}

/**
 * Read the selected photos from one active surfboard listing and match them to the catalog.
 * The listing's saved brand and model are not given to the vision model.
 */
export async function matchActiveListingPhotos(
  supabase: SupabaseClient,
  input: { listingId: string; imageIds: readonly string[] },
): Promise<SellListingPhotoMatchOutcome> {
  const imageIds = [...new Set(input.imageIds)]
  if (imageIds.length < 1 || imageIds.length > SELL_PHOTO_MATCH_LISTING_IMAGE_LIMIT) {
    return { ok: false, error: "Choose up to 6 photos from the listing.", status: 422 }
  }

  const listing = await getActiveSurfboardListingPhotos(supabase, input.listingId, imageIds)
  if (!listing) {
    return { ok: false, error: "That live listing is not available.", status: 404 }
  }
  if (listing.images.length !== imageIds.length) {
    return { ok: false, error: "Choose photos from that listing.", status: 422 }
  }

  const images = (
    await Promise.all(listing.images.map((image) => readListingImage(image.url)))
  ).filter((image): image is SellPhotoMatchImage => image !== null)
  if (images.length === 0) {
    return { ok: false, error: "Could not read those listing photos.", status: 422 }
  }

  const matched = await matchSellListingPhotos({ supabase, images })
  if (!matched.ok) return matched
  return { ok: true, data: matched.data, listing }
}
