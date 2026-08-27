import type { ReactNode } from "react"
import Link from "next/link"
import { Truck } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SellerRatingStarRow } from "@/components/seller-rating-stars"
import { SellerDirectoryMosaicImage } from "@/components/sellers/seller-directory-mosaic-image"
import { SellerDirectoryTileFollow } from "@/components/sellers/seller-directory-tile-follow"
import { sellerProfileHref } from "@/lib/seller-slug"
import {
  buildSellerDirectoryMosaicSlots,
  sellerDirectoryMosaicHasRenderableImage,
  type SellerDirectoryMosaicSlot,
} from "@/lib/sellers/directory-mosaic-images"
import { homePeerListingGridCardClass, homePeerListingGridImageSizes } from "@/lib/home-listing-scroll-styles"
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

function SellerDirectoryMosaic({
  slots,
  href,
  imagePriority,
}: {
  slots: SellerDirectoryMosaicSlot[]
  href: string
  imagePriority?: boolean
}) {
  const hasImages = sellerDirectoryMosaicHasRenderableImage(slots)

  if (!hasImages) {
    return (
      <Link
        href={href}
        className="block aspect-[3/4] w-full rounded-t-xl bg-muted outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="View seller profile"
      />
    )
  }

  return (
    <Link
      href={href}
      className="block outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
    >
      <SellerDirectoryMosaicImage
        slot={slots[0]!}
        className="aspect-[3/4] w-full shrink-0 rounded-t-xl"
        sizes={homePeerListingGridImageSizes}
        priority={imagePriority}
      />
    </Link>
  )
}

function PolicyIcon({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
      {children}
    </span>
  )
}

export function SellerDirectoryCard({
  shop,
  thumbs,
  tileMeta,
  avgRating,
  reviewCount,
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

  return (
    <article className={cn(homePeerListingGridCardClass, className)}>
      <SellerDirectoryMosaic slots={mosaicSlots} href={href} imagePriority={imagePriority} />

      <div className="px-2.5 pb-2 pt-2.5">
        <div className="flex items-start gap-2">
          <Link
            href={href}
            className="shrink-0 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={avatarSrc} alt="" />
              <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                {label.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex min-w-0 flex-col items-start gap-1.5">
              <Link
                href={href}
                className="min-w-0 w-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              >
                <h2 className="break-words text-[15px] font-bold leading-snug text-foreground">
                  {label}
                </h2>
              </Link>

              <SellerDirectoryTileFollow
                sellerId={shop.id}
                sellerSlug={shop.seller_slug}
                sellerName={label}
                initialFollowing={initialFollowing}
                isLoggedIn={isLoggedIn}
                isOwnProfile={isOwnProfile}
              />
            </div>

            {reviewCount > 0 ? (
              <div
                className="mt-1 flex min-w-0 items-center gap-1"
                role="img"
                aria-label={`${avgRating.toFixed(1)} out of 5 stars from ${reviewCount} reviews`}
              >
                <SellerRatingStarRow value={avgRating} size="sm" className="shrink-0" />
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  ({reviewCount})
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-1 px-2.5 pb-2.5 pt-0">
        {tileMeta.offersShipping ? (
          <>
            {tileMeta.shipFromState ? (
              <p className="text-[11px] font-medium leading-snug text-muted-foreground">
                Ships from {tileMeta.shipFromState}
              </p>
            ) : null}
            {tileMeta.shippingLine ? (
              <div className="flex items-center gap-1.5">
                <PolicyIcon>
                  <Truck className="h-3 w-3" aria-hidden />
                </PolicyIcon>
                <p className="text-[11px] font-medium leading-snug text-muted-foreground">
                  {tileMeta.shippingLine}
                </p>
              </div>
            ) : null}
          </>
        ) : tileMeta.locatedInLabel ? (
          <p className="text-[11px] font-medium leading-snug text-muted-foreground">
            {tileMeta.locatedInLabel}
          </p>
        ) : null}
      </div>
    </article>
  )
}
