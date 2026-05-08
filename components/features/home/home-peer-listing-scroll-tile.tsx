/**
 * Homepage horizontal listing tiles — single module for peer surfboard rows (Recently added, categories, verified, etc.).
 * All tiles delegate to {@link ListingTile} with shared scroll styles from `@/lib/home-listing-scroll-styles`.
 */
import { ListingTile } from "@/components/listing-tile"
import { ListingTileCategoryPill } from "@/components/listing-tile-category-pill"
import { ListingTileAddToCartServerIcon } from "@/components/listing-tile-add-to-cart-server-icon"
import { capitalizeWords, formatHomePeerListingConditionLine, formatListingTileCategoryPillText } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import { computePeerCartPriceAction } from "@/lib/peer-listing-cart"
import type { ListingImageForCard } from "@/lib/listing-image-display"
import {
  homeListingScrollImageSizes,
  homePeerListingGridCardClass,
  homePeerListingGridImageSizes,
  homeUniformScrollBodyClass,
  homeUniformScrollCardClass,
  homeUniformScrollLinkClass,
  homeUniformScrollMetaFooterClass,
  homeUniformScrollTitleSlotClass,
  homePeerListingTileTitleClass,
  homePeerTileSubtitleClass,
  homePeerTilePriceClass,
} from "@/lib/home-listing-scroll-styles"
import { cn } from "@/lib/utils"

/** Matches {@link ListingTileAddToCartServerIcon} footprint so every tile row aligns. */
const homeScrollTileCartSlotClass = "inline-flex h-9 w-9 shrink-0"

export type HomePeerScrollListing = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: string | number
  status: string
  section: string
  local_pickup?: boolean | null
  shipping_available?: boolean | null
  listing_images?: ListingImageForCard[] | null
  categories?: { name?: string | null } | null | { name?: string | null }[] | null
  board_type?: string | null
  /** Listing condition (`listings.condition`) — surfaced as “Used — …” under title on homepage tiles. */
  condition?: string | null
}

/**
 * Standard peer surfboard tile: portrait image, heart, title → condition → price → cart + category pill.
 * `layout="homeScroll"` is homepage horizontal rows; `layout="grid"` fills listing-detail grids.
 */
export function HomePeerListingScrollTile({
  listing,
  userId,
  isFavorited,
  categoryPillLabel,
  layout = "homeScroll",
  onFavoritedChange,
}: {
  listing: HomePeerScrollListing
  userId: string | null
  isFavorited: boolean
  /** When set (e.g. Browse by Category), overrides {@link formatListingTileCategoryPillText}. */
  categoryPillLabel?: string | null
  layout?: "homeScroll" | "grid"
  /** Optional — e.g. cart favorites row removes a tile when unfavorited. */
  onFavoritedChange?: (favorited: boolean) => void
}) {
  const cart = computePeerCartPriceAction(userId, {
    id: listing.id,
    user_id: listing.user_id,
    section: listing.section,
    status: listing.status,
    local_pickup: listing.local_pickup,
    shipping_available: listing.shipping_available,
  })
  const pill =
    categoryPillLabel?.trim() ||
    formatListingTileCategoryPillText(listing) ||
    ""

  const conditionLine = formatHomePeerListingConditionLine(listing.condition)

  const isGrid = layout === "grid"

  return (
    <ListingTile
      href={listingDetailHref({
        id: listing.id,
        slug: listing.slug,
        section: listing.section,
      })}
      listingId={listing.id}
      title={listing.title}
      imageAlt={capitalizeWords(listing.title)}
      listingImages={listing.listing_images}
      price={Number(listing.price)}
      linkLayout="unified"
      linkClassName={homeUniformScrollLinkClass}
      cardClassName={isGrid ? homePeerListingGridCardClass : homeUniformScrollCardClass}
      cardContentClassName={homeUniformScrollBodyClass}
      imageSizes={isGrid ? homePeerListingGridImageSizes : homeListingScrollImageSizes}
      titleSlot={
        <div className={homeUniformScrollTitleSlotClass}>
          <h3 className={homePeerListingTileTitleClass}>{capitalizeWords(listing.title)}</h3>
        </div>
      }
      subtitle={
        conditionLine ? (
          <p className={homePeerTileSubtitleClass}>{conditionLine}</p>
        ) : null
      }
      footerSlot={
        <div className={homeUniformScrollMetaFooterClass}>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <p className={homePeerTilePriceClass}>${Number(listing.price).toFixed(2)}</p>
            {cart?.type === "addToCartServer" ? (
              <ListingTileAddToCartServerIcon listingId={cart.listingId} isLoggedIn={cart.isLoggedIn} />
            ) : (
              <span className={cn(homeScrollTileCartSlotClass)} aria-hidden />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <ListingTileCategoryPill label={pill || null} />
          </div>
        </div>
      }
      favorites={{
        initialFavorited: isFavorited,
        isLoggedIn: !!userId,
        onFavoritedChange,
      }}
    />
  )
}
