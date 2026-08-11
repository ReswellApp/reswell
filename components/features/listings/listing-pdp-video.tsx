"use client"

import { useMemo } from "react"
import { listingDirectPublicImageUrl } from "@/lib/listing-media-proxy-url"
import { cn } from "@/lib/utils"

export type ListingPdpVideoSource = {
  id?: string
  url: string
  thumbnail_url?: string | null
  content_type?: string | null
}

type ListingPdpVideoProps = {
  video: ListingPdpVideoSource
  title: string
  className?: string
}

/**
 * PDP product video. Uses the direct public storage URL so large files are not
 * buffered through the image media proxy (Meta/Google also consume that URL).
 */
export function ListingPdpVideo({ video, title, className }: ListingPdpVideoProps) {
  const src = useMemo(
    () => listingDirectPublicImageUrl(video.url) ?? video.url.trim(),
    [video.url],
  )
  const poster = useMemo(() => {
    const raw = video.thumbnail_url?.trim()
    if (!raw) return undefined
    return listingDirectPublicImageUrl(raw) ?? raw
  }, [video.thumbnail_url])

  if (!src) return null

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl bg-black shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
        className,
      )}
    >
      <video
        className="aspect-video w-full bg-black object-contain"
        controls
        playsInline
        preload="metadata"
        poster={poster}
        aria-label={`${title} video`}
      >
        <source src={src} type={video.content_type?.trim() || undefined} />
      </video>
    </div>
  )
}

export function primaryListingVideo<T extends ListingPdpVideoSource>(
  videos: T[] | null | undefined,
): T | null {
  if (!videos?.length) return null
  const sorted = [...videos].sort((a, b) => {
    const ao = "sort_order" in a && typeof (a as { sort_order?: number | null }).sort_order === "number"
      ? ((a as { sort_order?: number | null }).sort_order ?? 0)
      : 0
    const bo = "sort_order" in b && typeof (b as { sort_order?: number | null }).sort_order === "number"
      ? ((b as { sort_order?: number | null }).sort_order ?? 0)
      : 0
    return ao - bo
  })
  const first = sorted.find((v) => v.url?.trim())
  return first ?? null
}
