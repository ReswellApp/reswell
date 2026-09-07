"use client"

import { useState } from "react"
import Image from "next/image"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { MessageMediaImageLightbox } from "@/components/features/messages/message-media-image-lightbox"
import { marketplaceReviewAttachmentUrl } from "@/lib/marketplace-review-photos"
import type { MarketplaceReviewPhotoRef } from "@/lib/types/marketplace-review"

const photoFrameClass = "overflow-hidden rounded-lg border border-border/60 bg-muted/20"

function ReviewPhotoThumb({
  reviewId,
  index,
  fileName,
  size,
}: {
  reviewId: string
  index: number
  fileName: string
  size: "sm" | "md"
}) {
  const src = marketplaceReviewAttachmentUrl(reviewId, index)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const dim = size === "sm" ? "h-16 w-16" : "h-24 w-24 sm:h-28 sm:w-28"

  return (
    <div className={cn(photoFrameClass, dim, "relative shrink-0")}>
      {!loaded && !failed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : null}
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30 px-1 text-center text-[10px] leading-tight text-muted-foreground">
          Could not load
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`View photo: ${fileName}`}
          >
            <Image
              src={src}
              alt={fileName}
              width={size === "sm" ? 64 : 112}
              height={size === "sm" ? 64 : 112}
              unoptimized
              className={cn("h-full w-full object-cover", !loaded && "opacity-0")}
              onLoad={() => setLoaded(true)}
              onError={() => {
                setFailed(true)
                setLoaded(true)
              }}
            />
          </button>
          <MessageMediaImageLightbox
            open={lightboxOpen}
            onOpenChange={setLightboxOpen}
            src={src}
            title={fileName}
          />
        </>
      )}
    </div>
  )
}

export function MarketplaceReviewPhotos({
  reviewId,
  photos,
  size = "md",
  className,
}: {
  reviewId: string
  photos: MarketplaceReviewPhotoRef[] | undefined
  size?: "sm" | "md"
  className?: string
}) {
  if (!photos || photos.length === 0) return null

  return (
    <div className={cn("mt-2 flex flex-wrap gap-2", className)}>
      {photos.map((photo, index) => (
        <ReviewPhotoThumb
          key={`${reviewId}-${index}-${photo.fileName}`}
          reviewId={reviewId}
          index={index}
          fileName={photo.fileName}
          size={size}
        />
      ))}
    </div>
  )
}
