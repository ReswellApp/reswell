import { retryOnceOnSellSubmitAbort } from "@/lib/sell-flow/sell-submit-error"

export type ImpersonatedListingImagePayload = {
  url: string
  thumbnail_url?: string | null
  is_primary: boolean
  sort_order: number
}

export type ImpersonatedListingVideoPayload = {
  url: string
  thumbnail_url?: string | null
  content_type?: string | null
  duration_seconds?: number | null
  byte_size?: number | null
  sort_order: number
}

async function fetchImpersonateListingJson(
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<Response> {
  return retryOnceOnSellSubmitAbort(() => fetch(input, init))
}

export async function createImpersonatedListingViaApi(params: {
  listing: Record<string, unknown>
  images: ImpersonatedListingImagePayload[]
  videos?: ImpersonatedListingVideoPayload[]
}): Promise<
  | { ok: true; listingId: string; slug: string }
  | { ok: false; error: string }
> {
  const res = await fetchImpersonateListingJson("/api/admin/impersonate/create-listing", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      listing: params.listing,
      images: params.images,
      videos: params.videos ?? [],
    }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    listing_id?: string
    slug?: string
  }
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data.error === "string" ? data.error : "Failed to create listing",
    }
  }
  if (!data.listing_id || !data.slug) {
    return { ok: false, error: "Failed to create listing" }
  }
  return { ok: true, listingId: data.listing_id, slug: data.slug }
}

export type UpdateImpersonatedListingImageOp = {
  id?: string
  url?: string
  thumbnail_url?: string | null
  is_primary: boolean
  sort_order: number
}

export type UpdateImpersonatedListingVideoOp = {
  id?: string
  url: string
  thumbnailUrl?: string | null
  contentType?: string | null
  durationSeconds?: number | null
  byteSize?: number | null
  sortOrder?: number
}

export async function updateImpersonatedListingViaApi(params: {
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
  const res = await fetchImpersonateListingJson("/api/admin/impersonate/update-listing", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      listingId: params.listingId,
      listing: params.listing,
      removedImageIds: params.removedImageIds ?? [],
      images: params.images ?? [],
      removedVideoIds: params.removedVideoIds ?? [],
      videos: params.videos ?? [],
      catalog_snapshot: params.catalog_snapshot,
      publishFromDraft: params.publishFromDraft === true,
    }),
  })
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

export function listingImagesToImpersonatedPayload(
  images: {
    url: string
    thumbnailUrl?: string | null
  }[],
): ImpersonatedListingImagePayload[] {
  return images.map((img, index) => ({
    url: img.url,
    thumbnail_url: img.thumbnailUrl ?? null,
    is_primary: index === 0,
    sort_order: index,
  }))
}

export function listingVideosToImpersonatedPayload(
  videos: Array<{
    url: string
    thumbnailUrl?: string | null
    contentType?: string | null
    durationSeconds?: number | null
    byteSize?: number | null
    sortOrder?: number
  }>,
): ImpersonatedListingVideoPayload[] {
  return videos.map((video, index) => ({
    url: video.url,
    thumbnail_url: video.thumbnailUrl ?? null,
    content_type: video.contentType ?? null,
    duration_seconds: video.durationSeconds ?? null,
    byte_size: video.byteSize ?? null,
    sort_order: video.sortOrder ?? index,
  }))
}
