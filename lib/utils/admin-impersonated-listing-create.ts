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

export async function createImpersonatedListingViaApi(params: {
  listing: Record<string, unknown>
  images: ImpersonatedListingImagePayload[]
  videos?: ImpersonatedListingVideoPayload[]
}): Promise<
  | { ok: true; listingId: string; slug: string }
  | { ok: false; error: string }
> {
  const res = await fetch("/api/admin/impersonate/create-listing", {
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
