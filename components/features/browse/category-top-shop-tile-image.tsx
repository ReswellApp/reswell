"use client"

import Image from "next/image"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { cn } from "@/lib/utils"
import { useCategoryTopShopsImageWarm } from "@/components/features/browse/category-top-shops-image-warm"

const CATEGORY_TOP_SHOP_IMAGE_SIZES = "(max-width: 639px) 40svw, 176px"

/**
 * Shop-tile photo for the category top-shops carousel.
 *
 * Waits until the strip is near the viewport, then eager-loads so horizontally
 * off-screen tiles are already in the browser cache when the user scrolls.
 */
export function CategoryTopShopTileImage({
  src,
  imageFit,
}: {
  src: string
  imageFit: "contain" | "cover"
}) {
  const warm = useCategoryTopShopsImageWarm()

  if (!warm) {
    return <div className="absolute inset-0 bg-muted" aria-hidden />
  }

  return (
    <Image
      src={src}
      alt=""
      fill
      draggable={false}
      loading="eager"
      fetchPriority="low"
      sizes={CATEGORY_TOP_SHOP_IMAGE_SIZES}
      className={cn(
        "pointer-events-none",
        imageFit === "contain"
          ? "object-contain object-center p-3"
          : "object-cover object-center",
      )}
      unoptimized={listingImageShouldBypassOptimization(src)}
    />
  )
}
