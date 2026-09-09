import Image from "next/image"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { cn } from "@/lib/utils"

export function HowToSellListingPhoto({
  src,
  alt,
  sizes,
  priority = false,
  className,
}: {
  src: string
  alt: string
  sizes: string
  priority?: boolean
  className?: string
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={cn("object-cover object-center", className)}
      unoptimized={listingImageShouldBypassOptimization(src)}
    />
  )
}
