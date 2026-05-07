"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { portraitShimmer, squareShimmer } from "@/lib/image-shimmer"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import { Maximize2 } from "lucide-react"
import { ListingImageCarouselNavButton } from "@/components/features/listings/listing-image-carousel-nav-button"
import { ListingImageLightbox } from "@/components/features/listings/listing-image-lightbox"

interface ImageGalleryProps {
  images: Array<{
    id: string
    url: string
    is_primary: boolean
    thumbnail_url?: string | null
  }>
  title: string
  /** Sold listings: muted imagery + SOLD badge (no change to carousel behavior). */
  sold?: boolean
}

const SWIPE_MIN_PX = 48

export function ImageGallery({ images, title, sold }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const suppressHeroClickRef = useRef(false)

  /** One URL per gallery slide (same order as `images`) so lightbox index stays aligned. */
  const proxiedUrls = useMemo(
    () =>
      images.map((img) => proxiedListingImageSrc(img.url) || "/placeholder.svg"),
    [images],
  )

  // Load full listing photos once idle so arrow / thumbnail switches hit HTTP cache.
  // Main + thumbnails use the same `/media/listings/...` URLs with `unoptimized`, so
  // bytes are shared (unlike distinct `/_next/image?w=` variants per layout size).
  useEffect(() => {
    const urls = images
      .map((img) => proxiedListingImageSrc(img.url))
      .filter((u): u is string => Boolean(u))
    if (urls.length <= 1) return

    const warm = (url: string) => {
      const im = new window.Image()
      im.decoding = "async"
      im.src = url
    }

    // Neighbors of the first slide: many users hit “next” immediately.
    if (urls.length > 1) warm(urls[1])
    if (urls.length > 2) warm(urls[urls.length - 1])

    let cancelled = false
    const run = () => {
      if (cancelled) return
      for (const url of urls) {
        warm(url)
      }
    }

    const useIdle = typeof requestIdleCallback !== "undefined"
    const idleHandle = useIdle
      ? requestIdleCallback(run, { timeout: 2200 })
      : window.setTimeout(run, 180)

    return () => {
      cancelled = true
      if (useIdle) cancelIdleCallback(idleHandle as number)
      else window.clearTimeout(idleHandle)
    }
  }, [images])

  if (images.length === 0) {
    return (
      <div
        className="relative w-full rounded-xl bg-muted text-muted-foreground"
        style={{ paddingBottom: "133.33%" }}
      >
        <span className="absolute inset-0 flex items-center justify-center">No images available</span>
      </div>
    )
  }

  function goPrev() {
    setSelectedIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  function goNext() {
    setSelectedIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  function openLightbox() {
    setLightboxIndex(selectedIndex)
    setLightboxOpen(true)
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-full space-y-4 lg:max-w-[min(100%,32rem)]">
      <ListingImageLightbox
        open={lightboxOpen}
        onOpenChange={(o) => {
          setLightboxOpen(o)
          if (o) return
          setSelectedIndex(lightboxIndex)
        }}
        proxiedUrls={proxiedUrls}
        title={title}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        sold={sold}
      />

      {/* Main Image - 3:4 frame; image scales to fill (may crop edges) */}
      <div
        className="relative w-full overflow-hidden rounded-xl bg-muted ring-1 ring-black/[0.04] select-none touch-pan-y dark:ring-white/[0.06]"
        style={{ paddingBottom: "133.33%" }}
        onTouchStart={(e) => {
          if (images.length <= 1) return
          const t = e.touches[0]
          if (!t) return
          touchStartRef.current = { x: t.clientX, y: t.clientY }
        }}
        onTouchEnd={(e) => {
          const start = touchStartRef.current
          touchStartRef.current = null
          if (!start || images.length <= 1) return
          const t = e.changedTouches[0]
          if (!t) return
          const dx = t.clientX - start.x
          const dy = t.clientY - start.y
          if (Math.abs(dx) < SWIPE_MIN_PX) return
          if (Math.abs(dx) <= Math.abs(dy)) return
          suppressHeroClickRef.current = true
          window.setTimeout(() => {
            suppressHeroClickRef.current = false
          }, 400)
          if (dx > 0) goPrev()
          else goNext()
        }}
        onTouchCancel={() => {
          touchStartRef.current = null
        }}
      >
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={lightboxOpen}
          aria-label="View enlarged photos"
          onClick={() => {
            if (suppressHeroClickRef.current) return
            openLightbox()
          }}
          className="absolute inset-0 z-[6] cursor-zoom-in border-0 bg-transparent p-0 outline-none ring-inset ring-offset-0 transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="pointer-events-none absolute bottom-2 left-2 z-[8] rounded-full bg-background/82 px-2 py-1 backdrop-blur-sm">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground tabular-nums">
            <Maximize2 className="size-3.5 shrink-0 opacity-80" aria-hidden />
            Enlarge
          </span>
        </div>

        <div className="absolute inset-0">
          {images.map((image, i) => {
            const isSelected = i === selectedIndex
            return (
              <Image
                key={image.id}
                src={proxiedListingImageSrc(image.url) || "/placeholder.svg"}
                alt={`${title} - Image ${i + 1}`}
                fill
                unoptimized
                className={cn(
                  "object-cover object-center absolute inset-0 transition-opacity transition-duration-[420ms] ease-in-out",
                  isSelected ? "z-[2] opacity-100" : "z-[1] opacity-0",
                  sold && "[filter:grayscale(30%)]",
                )}
                priority={i === 0}
                fetchPriority={i === 0 ? "high" : "auto"}
                sizes="(max-width: 1024px) 100vw, 50vw"
                placeholder="blur"
                blurDataURL={portraitShimmer}
                aria-hidden={!isSelected}
              />
            )
          })}
        </div>
        {sold && (
          <>
            <div className="pointer-events-none absolute inset-0 z-[5] bg-black/[0.08]" aria-hidden />
            <div
              className="pointer-events-none absolute left-3 top-3 z-20 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white"
              style={{ backgroundColor: "#111" }}
            >
              Sold
            </div>
          </>
        )}

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <ListingImageCarouselNavButton
              direction="prev"
              variant="embed"
              sideClassName="left-2"
              srLabel="Previous image"
              onClick={(e) => {
                e.stopPropagation()
                goPrev()
              }}
            />
            <ListingImageCarouselNavButton
              direction="next"
              variant="embed"
              sideClassName="right-2"
              srLabel="Next image"
              onClick={(e) => {
                e.stopPropagation()
                goNext()
              }}
            />
          </>
        )}

        {/* Image counter */}
        {images.length > 1 && (
          <div className="absolute bottom-2 right-2 z-10 rounded bg-background/80 px-2 py-1 text-sm backdrop-blur-sm">
            {selectedIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnails - explicit 3:4 box (padding-bottom) so fill Image has a defined size */}
      {images.length > 1 && (
        <div className="flex max-w-full min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch]">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={`Show photo ${index + 1} in gallery`}
              className={cn(
                "flex-shrink-0 overflow-hidden rounded-lg border-2 bg-muted transition-colors",
                index === selectedIndex
                  ? "border-foreground/70 ring-2 ring-foreground/15"
                  : "border-transparent hover:border-muted-foreground/40"
              )}
            >
              <span
                className="relative block w-16 bg-muted"
                style={{ paddingBottom: "133.33%" }}
              >
                <span className="absolute inset-0">
                  <Image
                    src={
                      proxiedListingImageSrc(
                        image.thumbnail_url?.trim() || image.url,
                      ) || "/placeholder.svg"
                    }
                    alt={`${title} - Thumbnail ${index + 1}`}
                    fill
                    unoptimized
                    loading="eager"
                    className={cn("object-cover object-center", sold && "[filter:grayscale(30%)]")}
                    sizes="64px"
                    placeholder="blur"
                    blurDataURL={squareShimmer}
                  />
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
