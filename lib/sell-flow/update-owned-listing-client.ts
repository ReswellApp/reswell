"use client"

import { retryOnceOnSellSubmitAbort } from "@/lib/sell-flow/sell-submit-error"
import type {
  UpdateImpersonatedListingImageOp,
  UpdateImpersonatedListingVideoOp,
} from "@/lib/utils/admin-impersonated-listing-create"

export function peerImagesToOwnedUpdateOps(
  images: Array<{
    id?: string
    url: string
    thumbnailUrl?: string | null
    isPrimary?: boolean
    sortOrder?: number
  }>,
): UpdateImpersonatedListingImageOp[] {
  return images.map((img, index) => ({
    id: img.id,
    url: img.url,
    thumbnail_url: img.thumbnailUrl,
    is_primary: img.isPrimary ?? index === 0,
    sort_order: img.sortOrder ?? index,
  }))
}

export async function updateOwnedListingViaApi(params: {
  listingId: string
  listing: Record<string, unknown>
  removedImageIds?: string[]
  images?: UpdateImpersonatedListingImageOp[]
  removedVideoIds?: string[]
  videos?: UpdateImpersonatedListingVideoOp[]
  catalog_snapshot?: unknown
  publishFromDraft?: boolean
}): Promise<
  | { ok: true; slug: string; published: boolean }
  | { ok: false; error: string }
> {
  const res = await retryOnceOnSellSubmitAbort(() =>
    fetch(`/api/listings/${encodeURIComponent(params.listingId)}/owned-edit`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listing: params.listing,
        removedImageIds: params.removedImageIds ?? [],
        images: params.images ?? [],
        removedVideoIds: params.removedVideoIds ?? [],
        videos: params.videos ?? [],
        catalog_snapshot: params.catalog_snapshot,
        publishFromDraft: params.publishFromDraft === true,
      }),
    }),
  )
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    slug?: string
    published?: boolean
  }
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data.error === "string" ? data.error : "Failed to update listing",
    }
  }
  return {
    ok: true,
    slug: typeof data.slug === "string" ? data.slug : "",
    published: data.published === true,
  }
}

export function revalidateListingMutationClient(params: {
  listingId: string
  slug?: string | null
  navSearch?: boolean
}): void {
  void fetch("/api/listings/revalidate-mutation", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      listingId: params.listingId,
      slug: params.slug ?? null,
      navSearch: params.navSearch === true,
    }),
    keepalive: true,
  }).catch(() => {
    /* cache revalidation is best-effort */
  })
}

export function applyPublishedListingSideEffectsClient(listingId: string): void {
  void fetch(`/api/listings/${encodeURIComponent(listingId)}/publish-side-effects`, {
    method: "POST",
    credentials: "include",
    keepalive: true,
  }).catch(() => {
    /* search / merchant sync is best-effort after publish */
  })
}

export async function purgeListingImagesClient(
  listingId: string,
  imageRowIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}/purge-images`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageRowIds }),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data.error === "string" ? data.error : "Could not remove old photos from storage.",
    }
  }
  return { ok: true }
}
