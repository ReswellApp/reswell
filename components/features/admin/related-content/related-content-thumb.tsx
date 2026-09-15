import Image from "next/image"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"

export function RelatedContentThumb({
  src,
  alt = "",
}: {
  src: string | null
  alt?: string
}) {
  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="48px"
          className="object-cover"
          unoptimized={listingImageShouldBypassOptimization(src)}
        />
      ) : null}
    </div>
  )
}
