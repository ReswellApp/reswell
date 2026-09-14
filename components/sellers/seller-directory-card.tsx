import { Truck } from "lucide-react"
import { SellerRatingStarRow } from "@/components/seller-rating-stars"
import { SellerDirectoryStorefrontWindow } from "@/components/sellers/seller-directory-storefront-window"
import { SellerDirectoryTileFollow } from "@/components/sellers/seller-directory-tile-follow"
import { sellerProfileHref } from "@/lib/seller-slug"
import { listingProductCardSolidClassName } from "@/lib/listing-card-styles"
import {
  buildSellerDirectoryMosaicSlots,
  type SellerDirectoryMosaicSlot,
} from "@/lib/sellers/directory-mosaic-images"
import {
  sellerDirectoryMonogram,
  sellerDirectorySignature,
} from "@/lib/sellers/directory-signature"
import { resolveSellerProfileDisplayImageUrl } from "@/lib/sellers/profile-display-image"
import type { SellerDirectoryTileMeta } from "@/lib/sellers/directory-tile-meta"
import { cn } from "@/lib/utils"

export type SellerDirectoryListingThumb = {
  id: string
  title: string
  price: number | string | null
  slug: string | null
  section: string
  listing_images: { url: string; thumbnail_url?: string | null; is_primary?: boolean | null }[] | null
}

export type SellerDirectoryCardShop = {
  id: string
  seller_slug: string | null
  display_name: string | null
  avatar_url: string | null
  city: string | null
  is_shop: boolean | null
  shop_name: string | null
  shop_description: string | null
  shop_banner_url: string | null
  shop_logo_url: string | null
  shop_verified: boolean | null
  shop_address: string | null
  sales_count: number | null
}

type SellerDirectoryCardProps = {
  shop: SellerDirectoryCardShop
  thumbs: SellerDirectoryListingThumb[]
  tileMeta: SellerDirectoryTileMeta
  avgRating: number
  reviewCount: number
  inventoryCount: number
  initialFollowing: boolean
  isLoggedIn: boolean
  isOwnProfile: boolean
  /** Pre-resolved from the sellers directory cache when available. */
  avatarSrc?: string
  mosaicSlots?: SellerDirectoryMosaicSlot[]
  /** First-row tiles only — below-fold mosaics should lazy-load. */
  imagePriority?: boolean
  className?: string
}

function sellerLabel(shop: SellerDirectoryCardShop): string {
  return shop.shop_name?.trim() || shop.display_name?.trim() || "Seller"
}

function inventoryLine(inventoryCount: number, salesCount: number | null): string | null {
  if (inventoryCount > 0) {
    return `${inventoryCount} for sale`
  }
  if (salesCount && salesCount > 0) {
    return `${salesCount} sale${salesCount === 1 ? "" : "s"}`
  }
  return null
}

export function SellerDirectoryCard({
  shop,
  thumbs,
  tileMeta,
  avgRating,
  reviewCount,
  inventoryCount,
  initialFollowing,
  isLoggedIn,
  isOwnProfile,
  avatarSrc: avatarSrcProp,
  mosaicSlots: mosaicSlotsProp,
  imagePriority = false,
  className,
}: SellerDirectoryCardProps) {
  const label = sellerLabel(shop)
  const avatarSrc = avatarSrcProp ?? resolveSellerProfileDisplayImageUrl(shop, thumbs)
  const href = sellerProfileHref(shop)
  const mosaicSlots = mosaicSlotsProp ?? buildSellerDirectoryMosaicSlots(thumbs, shop)
  const stockLine = inventoryLine(inventoryCount, shop.sales_count)
  const locationShort = tileMeta.locationShort ?? shop.city?.trim() ?? null

  return (
    <article
      className={cn(
        listingProductCardSolidClassName,
        "flex h-full min-w-0 flex-col [content-visibility:auto] [contain-intrinsic-size:auto_28rem]",
        className,
      )}
    >
      <div className="relative">
        <SellerDirectoryStorefrontWindow
          href={href}
          slots={mosaicSlots}
          label={label}
          avatarSrc={avatarSrc}
          isShop={shop.is_shop === true}
          shopVerified={shop.shop_verified === true}
          locationShort={locationShort}
          monogram={sellerDirectoryMonogram(label)}
          signature={sellerDirectorySignature(shop.id)}
          imagePriority={imagePriority}
        />
        <div className="absolute right-2 top-2 z-10">
          <SellerDirectoryTileFollow
            sellerId={shop.id}
            sellerSlug={shop.seller_slug}
            sellerName={label}
            initialFollowing={initialFollowing}
            isLoggedIn={isLoggedIn}
            isOwnProfile={isOwnProfile}
          />
        </div>
      </div>

      {tileMeta.specialtyLine || stockLine || reviewCount > 0 || tileMeta.offersShipping ? (
        <div className="flex flex-1 flex-col gap-1.5 px-2.5 pb-2.5 pt-2">
          {tileMeta.specialtyLine || stockLine ? (
            <p className="truncate text-[11px] font-medium leading-snug text-muted-foreground">
              {[tileMeta.specialtyLine, stockLine].filter(Boolean).join(" · ")}
            </p>
          ) : null}

          {reviewCount > 0 ? (
            <div
              className="flex min-w-0 items-center gap-1"
              role="img"
              aria-label={`${avgRating.toFixed(1)} out of 5 stars from ${reviewCount} reviews`}
            >
              <SellerRatingStarRow value={avgRating} size="sm" className="shrink-0" />
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">({reviewCount})</span>
            </div>
          ) : null}

          {tileMeta.offersShipping ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
                <Truck className="h-3 w-3" aria-hidden />
              </span>
              <p className="truncate text-[11px] font-medium leading-snug text-muted-foreground">
                {tileMeta.shippingLine}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
