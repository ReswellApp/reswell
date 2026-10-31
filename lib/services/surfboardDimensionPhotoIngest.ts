import "server-only"

import { getSurfboardListingScanCandidate } from "@/lib/db/surfboardDimensionPhoto"
import { listingFullImageUrlFromRef } from "@/lib/listing-media-src"
import {
  isSurfboardDimensionPhotoMatchEnabled,
  matchSurfboardDimensionPhotos,
  type DimensionPhotoMatchImage,
} from "@/lib/services/surfboardDimensionPhotoMatch"
import { sniffSellPhotoMatchMime } from "@/lib/sell-flow/sell-photo-match"
import { createServiceRoleClient } from "@/lib/supabase/server"

const VISION_IMAGE_MAX_BYTES = 8_000_000

export type IngestSurfboardDimensionPhotoResult =
  | { ok: true; matchId: string }
  | {
      ok: false
      reason:
        | "not_found"
        | "not_surfboard"
        | "wrong_status"
        | "missing_image"
        | "query_failed"
        | "missing_service_role"
        | "vision_disabled"
        | "vision_failed"
        | "already_scanned"
    }

async function fetchBytes(
  url: string,
): Promise<{ bytes: Uint8Array; mediaType: "image/jpeg" | "image/png" | "image/webp" } | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.byteLength < 256 || bytes.byteLength > VISION_IMAGE_MAX_BYTES) return null
    const mediaType = sniffSellPhotoMatchMime(bytes)
    if (!mediaType) return null
    return { bytes, mediaType }
  } catch {
    return null
  }
}

async function fetchBestListingBytes(input: {
  url: string
  thumbnailUrl: string | null
}): Promise<{ bytes: Uint8Array; mediaType: "image/jpeg" | "image/png" | "image/webp" } | null> {
  const full = listingFullImageUrlFromRef(input.url) || input.url
  const thumb = input.thumbnailUrl?.trim() || null
  const primary = await fetchBytes(full)
  if (primary) return primary
  if (thumb && thumb !== full) return fetchBytes(thumb)
  return null
}

/**
 * On publish: vision-scan listing photos, find the dimensions close-up, read L×W×T,
 * and store an unrated match for admin review. Never copies listings.dimensions.
 */
export async function ingestSurfboardListingIntoDimensionPhotoRefs(
  listingId: string,
): Promise<IngestSurfboardDimensionPhotoResult> {
  const id = listingId.trim()
  if (!id) return { ok: false, reason: "not_found" }

  if (!isSurfboardDimensionPhotoMatchEnabled()) {
    return { ok: false, reason: "vision_disabled" }
  }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, reason: "missing_service_role" }
  }

  try {
    const { data: existing } = await service
      .from("surfboard_dimension_photo_matches")
      .select("id")
      .eq("listing_id", id)
      .eq("surface", "listing_scan")
      .limit(1)
      .maybeSingle()
    if (existing?.id) return { ok: false, reason: "already_scanned" }

    const candidate = await getSurfboardListingScanCandidate(service, id)
    if (!candidate.ok) return { ok: false, reason: candidate.reason }

    const shots: DimensionPhotoMatchImage[] = []
    for (let i = 0; i < candidate.candidate.images.length; i++) {
      const img = candidate.candidate.images[i]!
      const fetched = await fetchBestListingBytes({
        url: img.url,
        thumbnailUrl: img.thumbnailUrl,
      })
      if (!fetched) continue
      shots.push({
        shot: `photo_${i}`,
        bytes: fetched.bytes,
        mediaType: fetched.mediaType,
        previewUrl: listingFullImageUrlFromRef(img.url) || img.url,
      })
    }
    if (shots.length < 1) return { ok: false, reason: "missing_image" }

    const result = await matchSurfboardDimensionPhotos({
      supabase: service,
      surface: "listing_scan",
      shots,
      listingId: id,
      includeRefs: true,
    })
    if (!result.ok) return { ok: false, reason: "vision_failed" }
    return { ok: true, matchId: result.match.id }
  } catch (err) {
    console.error(
      "[surfboardDimensionPhotoIngest] failed:",
      err instanceof Error ? err.message : err,
    )
    return { ok: false, reason: "vision_failed" }
  }
}

/** Best-effort publish hook — never blocks listing go-live. */
export async function ingestSurfboardListingIntoDimensionPhotoRefsBestEffort(
  listingId: string,
): Promise<void> {
  const result = await ingestSurfboardListingIntoDimensionPhotoRefs(listingId)
  if (result.ok) return
  if (
    result.reason === "not_surfboard" ||
    result.reason === "wrong_status" ||
    result.reason === "missing_image" ||
    result.reason === "already_scanned" ||
    result.reason === "vision_disabled"
  ) {
    return
  }
  console.warn("[surfboardDimensionPhotoIngest] skipped:", listingId, result.reason)
}
