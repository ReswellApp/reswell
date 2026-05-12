"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ExternalLink, MapPinned } from "lucide-react"
import type { MessageLocationPayload } from "@/lib/validations/message-location-metadata"
import { googleMapsSearchUrl } from "@/lib/maps/google-static-map-url"
import { Skeleton } from "@/components/ui/skeleton"

interface MessageLocationCardProps {
  payload: MessageLocationPayload
  formattedTime: string
  /** First listing image from the thread (active listing banner). Same-origin `/media/listings/` or trusted URL. */
  listingThumbnailSrc: string | null
  listingImageAlt: string
  /** Thread listing metadata is still loading — show image-area skeleton instead of “unavailable”. */
  listingThumbnailPending?: boolean
}

export function MessageLocationCard({
  payload,
  formattedTime,
  listingThumbnailSrc,
  listingImageAlt,
  listingThumbnailPending = false,
}: MessageLocationCardProps) {
  const { formattedAddress, latitude, longitude } = payload
  const mapsHref = googleMapsSearchUrl(latitude, longitude)
  const hasThumb = listingThumbnailSrc != null && listingThumbnailSrc.length > 0
  const [imageDecoded, setImageDecoded] = useState(false)

  useEffect(() => {
    setImageDecoded(false)
  }, [listingThumbnailSrc])

  const showDecodeSkeleton = hasThumb && !imageDecoded

  return (
    <div className="max-w-[min(100%,18.5rem)] overflow-hidden rounded-2xl border-2 border-foreground bg-background text-foreground shadow-sm sm:max-w-[min(100%,21rem)] md:max-w-[min(100%,28rem)]">
      <div className="relative aspect-[5/4] w-full bg-muted">
        {listingThumbnailPending ? (
          <Skeleton
            className="absolute inset-0 h-full w-full rounded-none"
            aria-hidden
          />
        ) : hasThumb ? (
          <>
            {showDecodeSkeleton ? (
              <Skeleton
                className="absolute inset-0 z-10 h-full w-full rounded-none"
                aria-hidden
              />
            ) : null}
            <Image
              src={listingThumbnailSrc}
              alt={listingImageAlt}
              fill
              className="object-cover object-center"
              sizes="(max-width: 640px) 85vw, min(448px, 28rem)"
              onLoadingComplete={() => setImageDecoded(true)}
            />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-muted-foreground">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted-foreground/10 text-foreground">
              <MapPinned className="h-6 w-6" aria-hidden />
            </span>
            <p className="text-center text-[12px] font-medium leading-snug">Listing photo unavailable</p>
          </div>
        )}
      </div>

      <div className="border-t border-border/50 px-4 py-3.5 sm:px-[1.125rem] sm:py-4">
        <p className="whitespace-pre-wrap break-words text-[15px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
          {formattedAddress}
        </p>
        <Link
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-touch items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted/60"
        >
          Open in Google Maps
          <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
        </Link>
        <p className="mt-2.5 text-[11px] tabular-nums leading-none text-muted-foreground">{formattedTime}</p>
      </div>
    </div>
  )
}
