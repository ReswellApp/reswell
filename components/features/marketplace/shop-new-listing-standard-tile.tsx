import { ListingTile } from "@/components/listing-tile"
import { ListingPriceWithMarkdown } from "@/components/features/listings/listing-price-with-markdown"
import { ListingTileShopInventoryCartIcon } from "@/components/listing-tile-shop-inventory-cart-icon"
import { capitalizeWords, formatCategory } from "@/lib/listing-labels"
import { listingCardImageSrc, type ListingImageForCard } from "@/lib/listing-image-display"
import { listingDetailHref } from "@/lib/listing-href"
import {
  homeListingScrollImageSizes,
  homePeerListingGridCardClass,
  homeUniformScrollBodyClass,
  homeUniformScrollCardClass,
  homeUniformScrollLinkClass,
  homeUniformScrollMetaFooterClass,
  homeUniformScrollTitleSlotClass,
  homePeerListingTileTitleClass,
  homePeerTileSubtitleClass,
  homePeerTilePriceClass,
} from "@/lib/home-listing-scroll-styles"

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
 * Shop “new” inventory tile — matches homepage peer stack: title → category line → price + cart.
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
      cardClassName={isGrid ? homePeerListingGridCardClass : homeUniformScrollCardClass}
      cardContentClassName={homeUniformScrollBodyClass}
      imageSizes={isGrid ? gridImageSizes : homeListingScrollImageSizes}
      titleSlot={
        <div className={homeUniformScrollTitleSlotClass}>
          <h3 className={homePeerListingTileTitleClass}>{capitalizeWords(listing.title)}</h3>
        </div>
      }
      subtitle={<p className={homePeerTileSubtitleClass}>{pill || "New"}</p>}
      footerSlot={
        <div className={homeUniformScrollMetaFooterClass}>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0">
              <ListingPriceWithMarkdown
                priceUsd={listing.price}
                compareAtPriceUsd={listing.compare_at_price}
                priceClassName={homePeerTilePriceClass}
                compareClassName="text-sm text-muted-foreground line-through tabular-nums"
              />
            </div>
            {stockQuantity > 0 ? (
              <ListingTileShopInventoryCartIcon
                isLoggedIn={!!userId}
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
