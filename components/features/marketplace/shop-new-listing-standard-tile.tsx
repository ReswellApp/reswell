import { ListingTile } from "@/components/listing-tile"
import { ListingTileCategoryPill } from "@/components/listing-tile-category-pill"
import { ListingTileShopInventoryCartIcon } from "@/components/listing-tile-shop-inventory-cart-icon"
import { capitalizeWords, formatCategory } from "@/lib/listing-labels"
import { listingCardImageSrc, type ListingImageForCard } from "@/lib/listing-image-display"
import { listingDetailHref } from "@/lib/listing-href"
import { listingProductCardGridClassName } from "@/lib/listing-card-styles"
import {
  homeListingScrollImageSizes,
  homeUniformScrollBodyClass,
  homeUniformScrollCardClass,
  homeUniformScrollLinkClass,
  homeUniformScrollMetaFooterClass,
  homeUniformScrollTitleSlotClass,
  homeListingScrollHeadingClass,
} from "@/lib/home-listing-scroll-styles"
import { portraitShimmer } from "@/lib/image-shimmer"
import { cn } from "@/lib/utils"

const gridImageSizes = "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 20vw"

export type ShopNewListingStandardTileListing = {
  id: string
  slug: string | null
  title: string
  price: number
  compare_at_price?: number | null
  listing_images: ListingImageForCard[] | null
}

/**
 * Shop “new” inventory tile — matches peer surfboard tile chrome (portrait image, heart, title band, price + bag, category pill).
 * `layout="homeScroll"` is the homepage horizontal row width; `layout="grid"` fills responsive shop grids.
 */
export function ShopNewListingStandardTile({
  listing,
  stockQuantity,
  userId,
  isFavorited,
  categoryName,
  layout = "homeScroll",
  showFavorites = true,
}: {
  listing: ShopNewListingStandardTileListing
  stockQuantity: number
  userId: string | null
  isFavorited: boolean
  categoryName: string | null
  layout?: "homeScroll" | "grid"
  showFavorites?: boolean
}) {
  const imageUrl = listingCardImageSrc(listing.listing_images ?? null)
  const pill = categoryName?.trim() ? formatCategory(categoryName) : ""
  const isGrid = layout === "grid"

  return (
    <ListingTile
      href={listingDetailHref({ id: listing.id, slug: listing.slug, section: "new" })}
      listingId={listing.id}
      title={listing.title}
      imageAlt={capitalizeWords(listing.title)}
      listingImages={listing.listing_images}
      price={listing.price}
      linkLayout="unified"
      linkClassName={homeUniformScrollLinkClass}
      cardClassName={isGrid ? cn(listingProductCardGridClassName, "h-full") : homeUniformScrollCardClass}
      cardContentClassName={homeUniformScrollBodyClass}
      imageSizes={isGrid ? gridImageSizes : homeListingScrollImageSizes}
      blurDataURL={portraitShimmer}
      titleSlot={
        <div className={homeUniformScrollTitleSlotClass}>
          <h3 className={homeListingScrollHeadingClass}>{capitalizeWords(listing.title)}</h3>
        </div>
      }
      footerSlot={
        <div className={homeUniformScrollMetaFooterClass}>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0">
              <p className="text-base font-bold text-black dark:text-white tabular-nums">
                ${listing.price.toFixed(2)}
              </p>
              {listing.compare_at_price != null && listing.compare_at_price > listing.price ? (
                <p className="text-sm text-muted-foreground line-through tabular-nums">
                  ${listing.compare_at_price.toFixed(2)}
                </p>
              ) : null}
            </div>
            {stockQuantity > 0 ? (
              <ListingTileShopInventoryCartIcon
                item={{
                  id: listing.id,
                  name: listing.title,
                  price: listing.price,
                  image_url: imageUrl || null,
                  stock_quantity: stockQuantity,
                }}
              />
            ) : null}
          </div>
          <div className="mt-1 flex justify-end">
            <ListingTileCategoryPill label={pill || null} />
          </div>
        </div>
      }
      favorites={
        showFavorites
          ? {
              initialFavorited: isFavorited,
              isLoggedIn: !!userId,
            }
          : null
      }
      showFavorites={showFavorites}
    />
  )
}
