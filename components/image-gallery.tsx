"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { portraitShimmer, squareShimmer } from "@/lib/image-shimmer"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

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
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

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
        className="relative w-full bg-muted rounded-lg text-muted-foreground"
        style={{ paddingBottom: "133.33%" }}
      >
        <span className="absolute inset-0 flex items-center justify-center">No images available</span>
      </div>
    )
  }

  const selectedImage = images[selectedIndex]

  function goPrev() {
    setSelectedIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  function goNext() {
    setSelectedIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-full space-y-4 lg:max-w-[450px]">
      {/* Main Image - 3:4 frame; image scales to fill (may crop edges) */}
      <div
        className="relative w-full rounded-lg overflow-hidden bg-muted select-none touch-pan-y"
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
          if (dx > 0) goPrev()
          else goNext()
        }}
        onTouchCancel={() => {
          touchStartRef.current = null
        }}
      >
        <div className="absolute inset-0">
          <Image
            src={proxiedListingImageSrc(selectedImage.url) || "/placeholder.svg"}
            alt={`${title} - Image ${selectedIndex + 1}`}
            fill
            unoptimized
            className={cn(
              "object-cover object-center transition-opacity duration-300",
              sold && "[filter:grayscale(30%)]",
            )}
            priority={selectedIndex === 0}
            fetchPriority={selectedIndex === 0 ? "high" : "auto"}
            sizes="(max-width: 1024px) 100vw, 50vw"
            placeholder="blur"
            blurDataURL={portraitShimmer}
          />
        </div>
        {sold && (
          <>
            <div className="pointer-events-none absolute inset-0 z-[5] bg-black/[0.08]" aria-hidden />
            <div
              className="absolute left-3 top-3 z-20 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white"
              style={{ backgroundColor: "#111" }}
            >
              Sold
            </div>
          </>
        )}

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-80 hover:opacity-100 z-10"
              onClick={goPrev}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Previous image</span>
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-80 hover:opacity-100 z-10"
              onClick={goNext}
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Next image</span>
            </Button>
          </>
        )}

        {/* Image counter */}
        {images.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-sm z-10">
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
              className={cn(
                "flex-shrink-0 rounded-md overflow-hidden border-2 transition-colors bg-muted",
                index === selectedIndex
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-transparent hover:border-muted-foreground/50"
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
