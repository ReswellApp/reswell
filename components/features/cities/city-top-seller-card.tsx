import Image from "next/image"
import Link from "next/link"
import { VerifiedBadge } from "@/components/verified-badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  cityEntityTileBodyClass,
  cityEntityTileSubtitleClass,
  cityEntityTileTitleClass,
  homeUniformScrollCardClass,
  homeUniformScrollLinkClass,
  homeUniformScrollTitleSlotClass,
} from "@/lib/home-listing-scroll-styles"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import type { CityTopSeller } from "@/lib/types/city-top-sellers"
import { cn } from "@/lib/utils"

const CITY_TOP_SELLER_IMAGE_SIZES = "(max-width: 639px) 22svw, 112px"

export function CityTopSellerCard({
  seller,
  imagePriority = false,
  elevated = false,
}: {
  seller: CityTopSeller
  imagePriority?: boolean
  /** Soft bordered panel for city chapter bands. */
  elevated?: boolean
}) {
  const salesLabel =
    seller.salesCount === 1 ? "1 sale" : `${seller.salesCount.toLocaleString()} sales`

  return (
    <Card
      className={cn(
        homeUniformScrollCardClass,
        elevated &&
          "border border-[#001A4A]/10 bg-white shadow-sm hover:border-[#001A4A]/20 hover:shadow-md",
      )}
    >
      <Link
        href={seller.href}
        className={homeUniformScrollLinkClass}
        aria-label={`${seller.name}, ${salesLabel}`}
      >
        <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-t-lg bg-muted">
          {seller.imageSrc ? (
            <Image
              src={seller.imageSrc}
              alt=""
              fill
              priority={imagePriority}
              sizes={CITY_TOP_SELLER_IMAGE_SIZES}
              className={cn(
                "pointer-events-none",
                seller.imageFit === "contain"
                  ? "object-contain object-center p-1.5"
                  : "object-cover object-center",
              )}
              unoptimized={listingImageShouldBypassOptimization(seller.imageSrc)}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground"
              aria-hidden
            >
              {seller.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <CardContent
          className={cn("flex min-h-0 min-w-0 flex-1 flex-col", cityEntityTileBodyClass)}
        >
          <div className={homeUniformScrollTitleSlotClass}>
            <h3 className={cn(cityEntityTileTitleClass, "flex items-center gap-0.5")}>
              <span className="min-w-0 truncate">{seller.name}</span>
              {seller.shopVerified ? <VerifiedBadge size="sm" className="shrink-0" /> : null}
            </h3>
          </div>
          <p className={cn(cityEntityTileSubtitleClass, "tabular-nums")}>{salesLabel}</p>
        </CardContent>
      </Link>
    </Card>
  )
}
