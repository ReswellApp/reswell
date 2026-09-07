/**
 * Homepage horizontal listing tiles — single module for peer surfboard rows (Recently added, categories, verified, etc.).
 * All tiles delegate to {@link ListingTile} with shared scroll styles from `@/lib/home-listing-scroll-styles`.
 */
import type { ReactNode } from "react"
import { Truck } from "lucide-react"
import { ListingTile } from "@/components/listing-tile"
import { ListingPriceWithMarkdown } from "@/components/features/listings/listing-price-with-markdown"
import { ListingTileAddToCartServerIcon } from "@/components/listing-tile-add-to-cart-server-icon"
import { capitalizeWords, formatHomePeerListingConditionLine } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import { computePeerCartPriceAction } from "@/lib/peer-listing-cart"
import type { ListingImageForCard } from "@/lib/listing-image-display"
import {
  homeListingScrollImageSizes,
  homeMostViewedCompactBodyClass,
  homeMostViewedCompactPriceClass,
  homeMostViewedCompactSubtitleClass,
  homeMostViewedCompactTitleClass,
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
const homeCompactTileCartSlotClass = "inline-flex h-8 w-8 shrink-0"

export type HomePeerScrollListing = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: string | number
  compare_at_price?: number | string | null
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
 * Standard peer surfboard tile: portrait image, heart, title → condition → price + cart.
 * `layout="homeScroll"` is homepage horizontal rows; `layout="grid"` fills listing-detail grids.
 */
export function HomePeerListingScrollTile({
  listing,
  userId,
  isFavorited,
  layout = "homeScroll",
  imageSizesOverride,
  statusLabel,
  soldOverlay,
  footerTrailing,
  imageTopLeftOverlay,
  showFavorites = true,
  onFavoritedChange,
  imagePriority = false,
  compact = false,
  cardContentClassName,
  cardClassName,
  metaFooterClassName,
}: {
  listing: HomePeerScrollListing
  userId: string | null
  isFavorited: boolean
  layout?: "homeScroll" | "grid"
  /** Overrides default scroll/grid `sizes` on the listing image (e.g. PDP recent strip). */
  imageSizesOverride?: string
  statusLabel?: "sold" | "pending" | "ended" | null
  soldOverlay?: boolean
  /** Renders below the price + cart row inside the footer band (e.g. favorites: seller + location). */
  footerTrailing?: ReactNode
  imageTopLeftOverlay?: ReactNode
  showFavorites?: boolean
  /** Optional — e.g. cart favorites row removes a tile when unfavorited. */
  onFavoritedChange?: (favorited: boolean) => void
  /** Forwarded to ListingTile → ListingTileImageMedia — see its JSDoc for usage rules. */
  imagePriority?: boolean
  /** Narrower tile typography for homepage “most viewed” mosaic / scroll strip. */
  compact?: boolean
  /** Overrides default body inset (e.g. auth landing grid). */
  cardContentClassName?: string
  /** Overrides default card shell (e.g. city spotlight strip on navy). */
  cardClassName?: string
  /** Overrides footer spacing below title/subtitle. */
  metaFooterClassName?: string
}) {
  const cart = computePeerCartPriceAction(userId, {
    id: listing.id,
    user_id: listing.user_id,
    section: listing.section,
    status: listing.status,
    local_pickup: listing.local_pickup,
    shipping_available: listing.shipping_available,
  })
  const ships = !!listing.shipping_available

  const conditionLine = formatHomePeerListingConditionLine(listing.condition)

  const isGrid = layout === "grid"
  const imageSizes =
    imageSizesOverride ??
    (isGrid ? homePeerListingGridImageSizes : homeListingScrollImageSizes)

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
      imageTopLeftOverlay={imageTopLeftOverlay}
      imageSizes={imageSizes}
      imagePriority={imagePriority}
      linkLayout="unified"
      linkClassName={homeUniformScrollLinkClass}
      cardClassName={
        cardClassName ?? (isGrid ? homePeerListingGridCardClass : homeUniformScrollCardClass)
      }
      cardContentClassName={
        cardContentClassName ??
        (compact ? homeMostViewedCompactBodyClass : homeUniformScrollBodyClass)
      }
      titleSlot={
        <div className={homeUniformScrollTitleSlotClass}>
          <h3 className={compact ? homeMostViewedCompactTitleClass : homePeerListingTileTitleClass}>
            {capitalizeWords(listing.title)}
          </h3>
        </div>
      }
      subtitle={
        conditionLine ? (
          <p className={compact ? homeMostViewedCompactSubtitleClass : homePeerTileSubtitleClass}>
            {conditionLine}
          </p>
        ) : null
      }
      statusLabel={statusLabel}
      soldOverlay={soldOverlay}
      footerSlot={
        <div className={metaFooterClassName ?? homeUniformScrollMetaFooterClass}>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <p className={compact ? homeMostViewedCompactPriceClass : homePeerTilePriceClass}>
              <ListingPriceWithMarkdown
                priceUsd={Number(listing.price)}
                compareAtPriceUsd={listing.compare_at_price}
                priceClassName={compact ? homeMostViewedCompactPriceClass : homePeerTilePriceClass}
                compareClassName="text-sm font-medium text-muted-foreground line-through tabular-nums"
              />
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              {ships ? (
                <span
                  className="inline-flex shrink-0 items-center justify-center text-muted-foreground"
                  title="Ships"
                  aria-label="Ships"
                >
                  <Truck
                    className={cn("shrink-0", compact ? "h-3.5 w-3.5" : "h-4 w-4")}
                    aria-hidden
                  />
                </span>
              ) : null}
              {cart?.type === "addToCartServer" ? (
                <ListingTileAddToCartServerIcon listingId={cart.listingId} isLoggedIn={cart.isLoggedIn} />
              ) : (
                <span
                  className={cn(compact ? homeCompactTileCartSlotClass : homeScrollTileCartSlotClass)}
                  aria-hidden
                />
              )}
            </div>
          </div>
          {footerTrailing ?? null}
        </div>
      }
      favorites={
        showFavorites
          ? {
              initialFavorited: isFavorited,
              isLoggedIn: !!userId,
              onFavoritedChange,
            }
          : null
      }
      showFavorites={showFavorites}
    />
  )
}
