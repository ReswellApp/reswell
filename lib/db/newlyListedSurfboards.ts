import type { SupabaseClient } from "@supabase/supabase-js"
import type { ListingRowForBoardAlert } from "@/lib/services/boardSavedSearchMatch"

const LISTING_SELECT =
  "id, user_id, section, status, hidden_from_site, title, description, price, brand, model, dimensions, board_type, condition, brand_id, brand_model_id, slug, fins_setup, fin_system, fin_size, wetsuit_size, apparel_kind, magazine_year"

/** One cron pass. A larger day continues on the next run from the watermark. */
export const NEWLY_LISTED_SURFBOARD_PAGE = 100

export type NewlyListedSurfboard = {
  listedAt: string
  listing: ListingRowForBoardAlert
  photoUrl: string | null
}

type CreationEventRow = {
  listing_id: string
  listed_at: string
}

type ImageRow = {
  listing_id: string
  url: string | null
  thumbnail_url: string | null
  is_primary: boolean | null
  sort_order: number | null
}

function photoUrlForListing(images: ImageRow[]): string | null {
  const ordered = [...images].sort((a, b) => {
    const primary = Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary))
    if (primary !== 0) return primary
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })
  for (const image of ordered) {
    const url = image.url?.trim() || image.thumbnail_url?.trim()
    if (url) return url
  }
  return null
}

/**
 * Active surfboards whose first publish (`listing_creation_events.listed_at`)
 * falls in `(listedAfter, listedThrough]`.
 */
export async function listNewlyListedActiveSurfboards(
  service: SupabaseClient,
  listedAfter: string,
  listedThrough: string,
): Promise<{ rows: NewlyListedSurfboard[]; capped: boolean; lastListedAt: string | null }> {
  const { data: events, error: eventErr } = await service
    .from("listing_creation_events")
    .select("listing_id, listed_at")
    .eq("section", "surfboards")
    .gt("listed_at", listedAfter)
    .lte("listed_at", listedThrough)
    .order("listed_at", { ascending: true })
    .limit(NEWLY_LISTED_SURFBOARD_PAGE)

  if (eventErr) throw new Error(eventErr.message)

  const eventRows = (events ?? []) as CreationEventRow[]
  const capped = eventRows.length >= NEWLY_LISTED_SURFBOARD_PAGE
  const lastListedAt = eventRows.length > 0 ? String(eventRows[eventRows.length - 1].listed_at) : null
  if (eventRows.length === 0) {
    return { rows: [], capped: false, lastListedAt: null }
  }

  const listedAtById = new Map(eventRows.map((event) => [event.listing_id, String(event.listed_at)]))
  const ids = [...listedAtById.keys()]

  const { data: listings, error: listingErr } = await service
    .from("listings")
    .select(LISTING_SELECT)
    .in("id", ids)
    .eq("section", "surfboards")
    .eq("status", "active")

  if (listingErr) throw new Error(listingErr.message)

  const active = ((listings ?? []) as ListingRowForBoardAlert[]).filter((row) => !row.hidden_from_site)
  if (active.length === 0) {
    return { rows: [], capped, lastListedAt }
  }

  const { data: images, error: imageErr } = await service
    .from("listing_images")
    .select("listing_id, url, thumbnail_url, is_primary, sort_order")
    .in(
      "listing_id",
      active.map((row) => row.id),
    )

  if (imageErr) throw new Error(imageErr.message)

  const imagesByListing = new Map<string, ImageRow[]>()
  for (const image of (images ?? []) as ImageRow[]) {
    const bucket = imagesByListing.get(image.listing_id) ?? []
    bucket.push(image)
    imagesByListing.set(image.listing_id, bucket)
  }

  const rows = active.flatMap((listing) => {
    const listedAt = listedAtById.get(listing.id)
    if (!listedAt) return []
    return [
      {
        listedAt,
        listing,
        photoUrl: photoUrlForListing(imagesByListing.get(listing.id) ?? []),
      },
    ]
  })

  return { rows, capped, lastListedAt }
}
