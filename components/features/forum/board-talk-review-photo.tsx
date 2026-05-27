"use client"

import { useState } from "react"
import Image from "next/image"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { MessageMediaImageLightbox } from "@/components/features/messages/message-media-image-lightbox"

const reviewPhotoFrameClass = "overflow-hidden rounded-xl border border-border/60 bg-muted/20"

export function BoardTalkReviewPhoto({
  reviewId,
  fileName,
  className,
}: {
  reviewId: string
  fileName: string
  className?: string
}) {
  const attachmentPath = `/api/board-reviews/${reviewId}/attachment`
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  return (
    <div className={cn(reviewPhotoFrameClass, className)}>
      <div className="relative">
        {!loaded && !failed ? (
          <div className="flex aspect-[4/3] w-full max-w-sm items-center justify-center bg-muted/30">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : null}
        {failed ? (
          <div className="flex aspect-[4/3] w-full max-w-sm items-center justify-center bg-muted/30 px-3 text-center text-sm text-muted-foreground">
            Could not load photo
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="block cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={`View photo: ${fileName}`}
            >
              <Image
                src={attachmentPath}
                alt={fileName}
                width={320}
                height={240}
                unoptimized
                className={cn(
                  "max-h-[min(42vh,15rem)] w-auto max-w-full object-contain",
                  !loaded && "absolute inset-0 opacity-0",
                )}
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
              src={attachmentPath}
              title={fileName}
            />
          </>
        )}
      </div>
    </div>
  )
}
