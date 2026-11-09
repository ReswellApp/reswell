"use client"

import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react"
import {
  listingDirectPublicImageUrl,
  listingPdpVideoPlaybackSrc,
} from "@/lib/listing-media-proxy-url"
import type { ListingPdpVideoSource } from "@/lib/primary-listing-video"
import { LISTING_GALLERY_VIDEO_CONTROLS_STRIP_PX } from "@/lib/utils/listing-gallery-touch"
import { cn } from "@/lib/utils"

export type { ListingPdpVideoSource }

type SurfaceGesture = { x: number; y: number; moved: boolean }

type ListingPdpVideoProps = {
  video: ListingPdpVideoSource
  title: string
  className?: string
  /** Fill the parent gallery frame instead of using a standalone 16:9 well. */
  fill?: boolean
  /** Pause playback when the slide is no longer selected. */
  active?: boolean
}

/**
 * PDP product video. Played through `/media/listing-videos` so large files are
 * streamed with Range support and a Chrome-safe Content-Type (not QuickTime).
 */
export function ListingPdpVideo({
  video,
  title,
  className,
  fill = false,
  active = true,
}: ListingPdpVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const surfaceGestureRef = useRef<SurfaceGesture | null>(null)
  const [failed, setFailed] = useState(false)
  const src = useMemo(() => listingPdpVideoPlaybackSrc(video.url), [video.url])
  const poster = useMemo(() => {
    const raw = video.thumbnail_url?.trim()
    if (!raw) return undefined
    return listingDirectPublicImageUrl(raw) ?? raw
  }, [video.thumbnail_url])

  useEffect(() => {
    setFailed(false)
  }, [src])

  useEffect(() => {
    if (active) return
    videoRef.current?.pause()
  }, [active])

  function rememberSurfacePoint(event: PointerEvent<HTMLElement>) {
    surfaceGestureRef.current = { x: event.clientX, y: event.clientY, moved: false }
  }

  function trackSurfaceMove(event: PointerEvent<HTMLElement>) {
    const gesture = surfaceGestureRef.current
    if (!gesture) return
    if (
      Math.abs(event.clientX - gesture.x) > 8 ||
      Math.abs(event.clientY - gesture.y) > 8
    ) {
      gesture.moved = true
    }
  }

  function onSurfaceClick(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation()
    const moved = surfaceGestureRef.current?.moved ?? false
    surfaceGestureRef.current = null
    if (moved) return
    const el = videoRef.current
    if (!el) return
    if (el.paused) {
      void el.play().catch(() => undefined)
    } else {
      el.pause()
    }
  }

  if (!src) return null

  return (
    <div
      className={cn(
        fill
          ? "absolute inset-0 bg-black"
          : "relative overflow-hidden rounded-2xl bg-black shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
        className,
      )}
    >
      <video
        ref={videoRef}
        src={src}
        className={cn(
          "relative z-[1] bg-black object-contain",
          fill ? "h-full w-full" : "aspect-video w-full",
        )}
        controls
        playsInline
        preload={active ? "auto" : "metadata"}
        poster={poster}
        aria-label={`${title} video`}
        onPointerDown={(event) => {
          event.stopPropagation()
          rememberSurfacePoint(event)
        }}
        onPointerMove={trackSurfaceMove}
        onClick={(event) => {
          event.stopPropagation()
          if (surfaceGestureRef.current?.moved) event.preventDefault()
          surfaceGestureRef.current = null
        }}
        onError={() => setFailed(true)}
      />
      {/* Picture area joins the gallery swipe. The bottom strip stays the native controls. */}
      <div
        className="absolute inset-x-0 top-0 z-[2] transform-gpu [touch-action:pan-y]"
        aria-hidden={true}
        style={{ bottom: LISTING_GALLERY_VIDEO_CONTROLS_STRIP_PX }}
        onPointerDown={(event) => {
          event.stopPropagation()
          rememberSurfacePoint(event)
        }}
        onPointerMove={trackSurfaceMove}
        onClick={onSurfaceClick}
      />
      {failed ? (
        <p className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center px-6 text-center text-sm text-white/80">
          This video can’t play in this browser.
        </p>
      ) : null}
    </div>
  )
}
