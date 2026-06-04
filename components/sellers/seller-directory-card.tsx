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
  className?: string
}

function sellerLabel(shop: SellerDirectoryCardShop): string {
  return shop.shop_name?.trim() || shop.display_name?.trim() || "Seller"
}

function SellerDirectoryMosaic({
  slots,
  href,
}: {
  slots: SellerDirectoryMosaicSlot[]
  href: string
}) {
  const hasImages = sellerDirectoryMosaicHasRenderableImage(slots)

  if (!hasImages) {
    return (
      <Link
        href={href}
        className="block min-h-[152px] bg-muted outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[172px]"
        aria-label="View seller profile"
      />
    )
  }

  return (
    <Link
      href={href}
      className="block outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="grid h-[152px] grid-cols-[minmax(0,2fr)_minmax(0,1fr)] grid-rows-2 gap-0 overflow-hidden rounded-t-[16px] sm:h-[172px]">
        <SellerDirectoryMosaicImage
          slot={slots[0]!}
          className="col-span-1 row-span-2 h-full min-h-0"
          sizes="(max-width: 640px) 55vw, 220px"
          priority
        />
        <SellerDirectoryMosaicImage
          slot={slots[1]!}
          className="h-full min-h-0"
          sizes="(max-width: 640px) 28vw, 110px"
        />
        <SellerDirectoryMosaicImage
          slot={slots[2]!}
          className="h-full min-h-0"
          sizes="(max-width: 640px) 28vw, 110px"
        />
      </div>
    </Link>
  )
}

function PolicyIcon({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
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
  className,
}: SellerDirectoryCardProps) {
  const label = sellerLabel(shop)
  const avatarSrc = resolveSellerProfileDisplayImageUrl(shop, thumbs)
  const href = sellerProfileHref(shop)
  const mosaicSlots = buildSellerDirectoryMosaicSlots(thumbs, shop)

  return (
    <article
      className={cn(
        "overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-[0_2px_12px_rgba(0,0,0,0.06)]",
        className,
      )}
    >
      <SellerDirectoryMosaic slots={mosaicSlots} href={href} />

      <div className="flex items-start gap-3 px-4 pb-3 pt-3.5">
        <Link
          href={href}
          className="flex min-w-0 flex-1 items-start gap-3 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={avatarSrc} alt="" />
            <AvatarFallback className="bg-muted text-sm font-semibold text-foreground">
              {label.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 pt-0.5">
            <h2 className="truncate text-[15px] font-bold leading-tight text-foreground">{label}</h2>
            {reviewCount > 0 ? (
              <div
                className="mt-1 flex items-center gap-1"
                role="img"
                aria-label={`${avgRating.toFixed(1)} out of 5 stars from ${reviewCount} reviews`}
              >
                <SellerRatingStarRow value={avgRating} size="sm" />
                <span className="text-sm tabular-nums text-muted-foreground">({reviewCount})</span>
              </div>
            ) : null}
          </div>
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

      <div className="min-h-[4.75rem] space-y-2 px-4 pb-4 pt-0.5">
        {tileMeta.offersShipping ? (
          <>
            {tileMeta.shipFromState ? (
              <p className="text-[15px] font-bold leading-snug text-primary">
                Ships from {tileMeta.shipFromState}
              </p>
            ) : null}
            {tileMeta.shippingLine ? (
              <div className="flex items-center gap-2.5">
                <PolicyIcon>
                  <Truck className="h-3.5 w-3.5" aria-hidden />
                </PolicyIcon>
                <p className="text-[15px] font-bold leading-snug text-primary">{tileMeta.shippingLine}</p>
              </div>
            ) : null}
          </>
        ) : tileMeta.locatedInLabel ? (
          <p className="text-[15px] font-bold leading-snug text-primary">{tileMeta.locatedInLabel}</p>
        ) : null}
      </div>
    </article>
  )
}
