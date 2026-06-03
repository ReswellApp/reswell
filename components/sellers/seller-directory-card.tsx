import type { ReactNode } from "react"
import Link from "next/link"
import Image from "next/image"
import { Truck } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SellerRatingStarRow } from "@/components/seller-rating-stars"
import { SellerDirectoryTileFollow } from "@/components/sellers/seller-directory-tile-follow"
import { wideShimmer } from "@/lib/image-shimmer"
import { listingCardImageSrc } from "@/lib/listing-image-display"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { sellerProfileHref } from "@/lib/seller-slug"
import type { SellerDirectoryTileMeta } from "@/lib/sellers/directory-tile-meta"
import { cn } from "@/lib/utils"

const PLACEHOLDER_IMAGE = "/placeholder.svg"

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

function ListingMosaicImage({
  listing,
  className,
  sizes,
  priority,
}: {
  listing: SellerDirectoryListingThumb | undefined
  className?: string
  sizes: string
  priority?: boolean
}) {
  const src = listing
    ? listingCardImageSrc(listing.listing_images) || PLACEHOLDER_IMAGE
    : PLACEHOLDER_IMAGE

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <Image
        src={src}
        alt={listing?.title ?? ""}
        fill
        sizes={sizes}
        className="object-cover"
        unoptimized={listingImageShouldBypassOptimization(src)}
        placeholder="blur"
        blurDataURL={wideShimmer}
        priority={priority}
      />
    </div>
  )
}

function PolicyIcon({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d8f0df] text-foreground">
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
  const avatarSrc = shop.shop_logo_url || shop.avatar_url || ""
  const href = sellerProfileHref(shop)
  const mosaic = thumbs.slice(0, 3)
  const hasPolicyFooter = tileMeta.shipFromState || tileMeta.shippingLine

  return (
    <article
      className={cn(
        "overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-[0_2px_12px_rgba(0,0,0,0.06)]",
        className,
      )}
    >
      <Link
        href={href}
        className="block outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] grid-rows-2 gap-[2px] bg-white p-[2px]">
          <ListingMosaicImage
            listing={mosaic[0]}
            className="col-span-1 row-span-2 min-h-[152px] rounded-tl-[16px] sm:min-h-[172px]"
            sizes="(max-width: 640px) 55vw, 220px"
            priority
          />
          <ListingMosaicImage
            listing={mosaic[1]}
            className="min-h-[75px] rounded-tr-[16px] sm:min-h-[85px]"
            sizes="(max-width: 640px) 28vw, 110px"
          />
          <ListingMosaicImage
            listing={mosaic[2]}
            className="min-h-[75px] sm:min-h-[85px]"
            sizes="(max-width: 640px) 28vw, 110px"
          />
        </div>
      </Link>

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
                <span className="text-sm tabular-nums text-neutral-500">({reviewCount})</span>
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

      {hasPolicyFooter ? (
        <div className="space-y-2 px-4 pb-4 pt-0.5">
          {tileMeta.shipFromState ? (
            <p className="text-[15px] font-bold leading-snug text-[#1b5e3b]">
              Ships from {tileMeta.shipFromState}
            </p>
          ) : null}
          {tileMeta.shippingLine ? (
            <div className="flex items-center gap-2.5">
              <PolicyIcon>
                <Truck className="h-3.5 w-3.5" aria-hidden />
              </PolicyIcon>
              <p className="text-[15px] font-bold leading-snug text-[#1b5e3b]">{tileMeta.shippingLine}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
