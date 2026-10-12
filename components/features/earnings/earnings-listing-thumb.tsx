import Image from "next/image"
import { Package } from "lucide-react"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { cn } from "@/lib/utils"

export function EarningsListingThumb({
  src,
  alt,
  className,
}: {
  src: string | null
  alt: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border/80 bg-muted",
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes="36px"
          unoptimized={listingImageShouldBypassOptimization(src)}
        />
      ) : (
        <Package className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground" aria-hidden />
      )}
    </div>
  )
}
