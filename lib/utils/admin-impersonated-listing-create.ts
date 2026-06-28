export type ImpersonatedListingImagePayload = {
  url: string
  thumbnail_url?: string | null
  is_primary: boolean
  sort_order: number
}

export async function createImpersonatedListingViaApi(params: {
  listing: Record<string, unknown>
  images: ImpersonatedListingImagePayload[]
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
