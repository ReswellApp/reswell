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
  homeMostViewedCompactBodyClass,
  homeMostViewedCompactSubtitleClass,
  homeMostViewedCompactTitleClass,
  homePeerListingGridCardClass,
  homeUniformScrollCardClass,
  homeUniformScrollLinkClass,
  homeUniformScrollTitleSlotClass,
} from "@/lib/home-listing-scroll-styles"
import { cn } from "@/lib/utils"

const CITY_SURF_SHOP_IMAGE_SIZES = "(max-width: 639px) 30svw, 160px"
const DIRECTORY_SURF_SHOP_IMAGE_SIZES =
  "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 208px"

export function SurfShopCard({
  shop,
  imagePriority = false,
  layout = "scroll",
}: {
  shop: CitySurfShop
  imagePriority?: boolean
  layout?: "scroll" | "grid"
}) {
  const location = surfShopLocationLabel(shop)
  const isGrid = layout === "grid"

  return (
    <Card className={isGrid ? homePeerListingGridCardClass : homeUniformScrollCardClass}>
      <Link
        href={surfShopHref(shop.slug)}
        className={homeUniformScrollLinkClass}
        aria-label={`${shop.name}, ${location}`}
      >
        <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-t-xl bg-white">
          <Image
            src={shop.logoSrc}
            alt=""
            fill
            priority={imagePriority}
            sizes={isGrid ? DIRECTORY_SURF_SHOP_IMAGE_SIZES : CITY_SURF_SHOP_IMAGE_SIZES}
            className="object-contain p-3"
          />
        </div>
        <CardContent
          className={cn("flex min-h-0 min-w-0 flex-1 flex-col", homeMostViewedCompactBodyClass)}
        >
          <div className={homeUniformScrollTitleSlotClass}>
            <h3 className={homeMostViewedCompactTitleClass}>{shop.name}</h3>
          </div>
          <p className={cn(homeMostViewedCompactSubtitleClass, "flex min-w-0 items-center gap-1")}>
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{location}</span>
          </p>
        </CardContent>
      </Link>
    </Card>
  )
}
