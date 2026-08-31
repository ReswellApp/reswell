import Image from "next/image"
import Link from "next/link"
import { MapPin } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import {
  surfShopHref,
  surfShopLocationLabel,
  type CitySurfShop,
} from "@/lib/city-landing-surf-shops"
import {
  cityEntityTileBodyClass,
  cityEntityTileSubtitleClass,
  cityEntityTileTitleClass,
  homeMostViewedCompactBodyClass,
  homeMostViewedCompactSubtitleClass,
  homeMostViewedCompactTitleClass,
  homePeerListingGridCardClass,
  homeUniformScrollCardClass,
  homeUniformScrollLinkClass,
  homeUniformScrollTitleSlotClass,
} from "@/lib/home-listing-scroll-styles"
import { cn } from "@/lib/utils"

const CITY_SURF_SHOP_IMAGE_SIZES = "(max-width: 639px) 22svw, 112px"
const DIRECTORY_SURF_SHOP_IMAGE_SIZES =
  "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 208px"

export function SurfShopCard({
  shop,
  imagePriority = false,
  layout = "scroll",
  density = "default",
  elevated = false,
}: {
  shop: CitySurfShop
  imagePriority?: boolean
  layout?: "scroll" | "grid"
  /** City landing strips use compact; directory grid stays default. */
  density?: "default" | "compact"
  /** Soft bordered panel for city chapter bands. */
  elevated?: boolean
}) {
  const location = surfShopLocationLabel(shop)
  const isGrid = layout === "grid"
  const isCompact = !isGrid && density === "compact"

  const bodyClass = isCompact ? cityEntityTileBodyClass : homeMostViewedCompactBodyClass
  const titleClass = isCompact ? cityEntityTileTitleClass : homeMostViewedCompactTitleClass
  const subtitleClass = isCompact
    ? cityEntityTileSubtitleClass
    : homeMostViewedCompactSubtitleClass

  return (
    <Card
      className={cn(
        isGrid ? homePeerListingGridCardClass : homeUniformScrollCardClass,
        elevated &&
          "border border-[#001A4A]/10 bg-white shadow-sm hover:border-[#001A4A]/20 hover:shadow-md",
      )}
    >
      <Link
        href={surfShopHref(shop.slug)}
        className={homeUniformScrollLinkClass}
        aria-label={`${shop.name}, ${location}`}
      >
        <div
          className={cn(
            "relative aspect-square w-full shrink-0 overflow-hidden bg-white",
            isCompact ? "rounded-t-lg" : "rounded-t-xl",
          )}
        >
          <Image
            src={shop.logoSrc}
            alt=""
            fill
            priority={imagePriority}
            sizes={isGrid ? DIRECTORY_SURF_SHOP_IMAGE_SIZES : CITY_SURF_SHOP_IMAGE_SIZES}
            className={cn("object-contain", isCompact ? "p-1.5" : "p-3")}
          />
        </div>
        <CardContent className={cn("flex min-h-0 min-w-0 flex-1 flex-col", bodyClass)}>
          <div className={homeUniformScrollTitleSlotClass}>
            <h3 className={titleClass}>{shop.name}</h3>
          </div>
          <p className={cn(subtitleClass, "flex min-w-0 items-center gap-1")}>
            <MapPin className={cn("shrink-0", isCompact ? "h-2.5 w-2.5" : "h-3 w-3")} aria-hidden />
            <span className="truncate">{location}</span>
          </p>
        </CardContent>
      </Link>
    </Card>
  )
}
