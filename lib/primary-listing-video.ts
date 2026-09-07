export type ListingPdpVideoSource = {
  id?: string
  url: string
  thumbnail_url?: string | null
  content_type?: string | null
  sort_order?: number | null
}

/** First playable listing video by sort order. Server-safe (not a client module export). */
export function primaryListingVideo<T extends ListingPdpVideoSource>(
  videos: T[] | null | undefined,
): T | null {
  if (!videos?.length) return null
  const sorted = [...videos].sort((a, b) => {
    const ao = typeof a.sort_order === "number" ? a.sort_order : 0
    const bo = typeof b.sort_order === "number" ? b.sort_order : 0
    return ao - bo
  })
  const first = sorted.find((v) => v.url?.trim())
  return first ?? null
}
