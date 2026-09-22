import type { HomePeerScrollListing } from "@/components/features/home/home-peer-listing-scroll-tile"
import {
  coalesceListingImagesForCard,
  hydrateCardListingImages,
  listingCoverImageForCard,
  type ListingImageForCard,
} from "@/lib/listing-image-display"

/**
 * Shared homepage / PDP peer listing payloads.
 * Cover photos use denormalized `primary_*` / `tile_gallery_images` —
 * no `listing_images` join. Call {@link hydrateHomePeerListingRows} after fetch.
 * Homepage HTML uses {@link projectHomePeerCardListing} so each card keeps one cover.
 */
export const HOME_PEER_LISTING_WITH_PROFILE_SELECT = `
  *,
  profiles!listings_user_id_fkey (display_name, avatar_url, location, sales_count, shop_verified),
  categories (name)
`

/** Attach card `listing_images` from denormalized primary_* fields. */
export function hydrateHomePeerListingRows<T extends Record<string, unknown>>(
  rows: T[] | null | undefined,
) {
  return hydrateCardListingImages(Array.isArray(rows) ? rows : [])
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function readNullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

/**
 * Fields a homepage card actually renders. Strips descriptions, specs, and
 * gallery slides before the row crosses into a client component.
 */
export function projectHomePeerCardListing(row: object): HomePeerScrollListing {
  const source = row as Record<string, unknown>
  const categories = source.categories
  const price = source.price
  const compareAt = source.compare_at_price
  return {
    id: String(source.id ?? ""),
    slug: readNullableString(source.slug),
    user_id: String(source.user_id ?? ""),
    title: typeof source.title === "string" ? source.title : "",
    price: typeof price === "number" || typeof price === "string" ? price : 0,
    compare_at_price:
      typeof compareAt === "number" || typeof compareAt === "string" ? compareAt : null,
    is_good_deal: readNullableBoolean(source.is_good_deal),
    status: typeof source.status === "string" ? source.status : "",
    section: typeof source.section === "string" ? source.section : "",
    hidden_from_site: readNullableBoolean(source.hidden_from_site),
    archived_at: readNullableString(source.archived_at),
    local_pickup: readNullableBoolean(source.local_pickup),
    shipping_available: readNullableBoolean(source.shipping_available),
    listing_images: listingCoverImageForCard(
      coalesceListingImagesForCard({
        listing_images: Array.isArray(source.listing_images)
          ? (source.listing_images as ListingImageForCard[])
          : null,
        primary_image_url: readNullableString(source.primary_image_url),
        primary_thumbnail_url: readNullableString(source.primary_thumbnail_url),
        tile_gallery_images: source.tile_gallery_images,
      }),
    ),
    categories:
      categories && typeof categories === "object"
        ? (categories as HomePeerScrollListing["categories"])
        : null,
    board_type: readNullableString(source.board_type),
    condition: readNullableString(source.condition),
  }
}
