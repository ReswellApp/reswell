"use client"

import { type CSSProperties, type PointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { preload } from "react-dom"
import dynamic from "next/dynamic"
import useEmblaCarousel from "embla-carousel-react"
import { cn } from "@/lib/utils"
import { listingTileImageSrcFromRow } from "@/lib/listing-image-display"
import {
  proxiedListingImageSrc,
  withListingMediaPdpVariant,
} from "@/lib/listing-media-proxy-url"
import { Maximize2, Play } from "lucide-react"
import {
  ListingGalleryPhoto,
  listingPhotoBackdropStyle,
} from "@/components/features/listings/listing-gallery-photo"
import { ListingImageCarouselNavButton } from "@/components/features/listings/listing-image-carousel-nav-button"
import { ListingPdpVideo } from "@/components/features/listings/listing-pdp-video"
import type { ListingPdpVideoSource } from "@/lib/primary-listing-video"

function preloadListingImageLightbox() {
  return import("@/components/features/listings/listing-image-lightbox")
}

/** Zoom/pan library only loads once the user first enlarges a photo. */
const ListingImageLightbox = dynamic(
  () => preloadListingImageLightbox().then((m) => m.ListingImageLightbox),
  { ssr: false, loading: () => null },
)

interface ImageGalleryProps {
  images: Array<{
    id: string
    url: string
    is_primary: boolean
    thumbnail_url?: string | null
  }>
  title: string
  /** Optional listing video — rendered as the last carousel slide, not above the photos. */
  video?: ListingPdpVideoSource | null
  /** Sold listings: SOLD badge on the hero. */
  sold?: boolean
  /** Mobile PDP: edge-to-edge hero, natural ratio, height-capped so title stays nearby. */
  compactMobile?: boolean
  /** Share / favorite controls — rendered on the hero tile so they track its bounds. */
  heroOverlay?: ReactNode
  /** Board dims line for enlarge chrome, e.g. `5'11″ × 18 3/8″ × 2 1/4″ · 27 L`. */
  dimensionsLine?: string | null
}

/** Ignore tap-to-enlarge once the finger has moved this far (Embla owns the swipe). */
const HERO_TAP_SLOP_PX = 8

/** Browser-cache full listing photos (same URLs as hero + lightbox). */
function warmListingImageSrc(url: string): void {
  if (!url || url === "/placeholder.svg") return
  const im = new window.Image()
  im.decoding = "async"
  im.src = url
}

function warmHeroSlideNeighbors(urls: string[], activeIndex: number): void {
  if (urls.length <= 1) return
  const indices = new Set<number>([activeIndex])
  indices.add((activeIndex + 1) % urls.length)
  indices.add((activeIndex - 1 + urls.length) % urls.length)
  for (const i of indices) {
    const url = urls[i]
    if (url) warmListingImageSrc(url)
  }
}

export function ImageGallery({
  images,
  title,
  video,
  sold,
  compactMobile,
  heroOverlay,
  dimensionsLine,
}: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  /** Mount once the zoom chunk is ready so the first enlarge is a state change, not a white shell. */
  const [lightboxMounted, setLightboxMounted] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  /** Natural width/height per slide — mobile hero uses this instead of a fixed crop frame. */
  const [imageAspectRatios, setImageAspectRatios] = useState<Record<number, number>>({})
  /** Aspect frame follows the settled slide so the hero height does not jump mid-swipe. */
  const [frameIndex, setFrameIndex] = useState(0)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const suppressHeroClickRef = useRef(false)
  const thumbRowRef = useRef<HTMLDivElement>(null)

  const hasVideo = Boolean(video?.url?.trim())
  const videoIndex = hasVideo ? images.length : -1
  const slideCount = images.length + (hasVideo ? 1 : 0)
  const canSwipe = slideCount > 1
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: canSwipe,
    align: "start",
    duration: 22,
    dragThreshold: 8,
    watchDrag: canSwipe,
  })

  const isVideoSelected = hasVideo && selectedIndex === videoIndex
  const isVideoFrame = hasVideo && frameIndex === videoIndex
  const mobileHeroAspectRatio = isVideoFrame
    ? 3 / 4
    : imageAspectRatios[frameIndex] ?? imageAspectRatios[selectedIndex] ?? 3 / 4

  /** Photo URLs only — video is a trailing carousel slide and stays out of the lightbox. */
  const proxiedUrls = useMemo(
    () =>
      images.map((img) => proxiedListingImageSrc(img.url) || "/placeholder.svg"),
    [images],
  )

  /** Hero slides: ≤1024px proxy variant — full-res stays lightbox-only. */
  const heroUrls = useMemo(
    () =>
      proxiedUrls.map((u) =>
        u === "/placeholder.svg" ? u : withListingMediaPdpVariant(u),
      ),
    [proxiedUrls],
  )

  const previewUrls = useMemo(
    () =>
      images.map((img, i) => {
        const preview = listingTileImageSrcFromRow(img)
        const hero = heroUrls[i]
        if (!preview || preview === hero || preview === "/placeholder.svg") return ""
        return preview
      }),
    [heroUrls, images],
  )

  const galleryUrls = useMemo(
    () => heroUrls.filter((u) => u && u !== "/placeholder.svg"),
    [heroUrls],
  )

  const firstHero = heroUrls[0]
  if (firstHero && firstHero !== "/placeholder.svg") {
    preload(firstHero, { as: "image", fetchPriority: "high" })
  }

  /** Stable primitive — never pass `images`/`proxiedUrls` arrays as effect deps (fixed length). */
  const galleryUrlsKey = useMemo(() => galleryUrls.join("|"), [galleryUrls])

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap())
    }
    const onSettle = () => {
      setFrameIndex(emblaApi.selectedScrollSnap())
    }
    const onReInit = () => {
      onSelect()
      onSettle()
    }
    onSelect()
    onSettle()
    emblaApi.on("select", onSelect)
    emblaApi.on("settle", onSettle)
    emblaApi.on("reInit", onReInit)
    return () => {
      emblaApi.off("select", onSelect)
      emblaApi.off("settle", onSettle)
      emblaApi.off("reInit", onReInit)
    }
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    if (emblaApi.selectedScrollSnap() === selectedIndex) return
    emblaApi.scrollTo(selectedIndex, true)
  }, [emblaApi, selectedIndex])

  // Warm every hero + tile URL so swipe never lands on an unloaded white slide.
  useEffect(() => {
    for (const url of heroUrls) warmListingImageSrc(url)
    for (const url of previewUrls) {
      if (url) warmListingImageSrc(url)
    }
    warmHeroSlideNeighbors(galleryUrls, selectedIndex)
  }, [galleryUrlsKey, selectedIndex])

  useEffect(() => {
    const row = thumbRowRef.current
    if (!row) return
    const active = row.querySelector<HTMLElement>(`[data-gallery-thumb="${selectedIndex}"]`)
    if (!active) return
    const rowRect = row.getBoundingClientRect()
    const thumbRect = active.getBoundingClientRect()
    if (thumbRect.left >= rowRect.left && thumbRect.right <= rowRect.right) return
    const nextLeft =
      row.scrollLeft + (thumbRect.left - rowRect.left) - (rowRect.width - thumbRect.width) / 2
    row.scrollTo({ left: Math.max(0, nextLeft), behavior: "smooth" })
  }, [selectedIndex])

  // Preload and mount the lightbox while idle so the first enlarge is a state change, not a remount.
  useEffect(() => {
    const mount = () => {
      void preloadListingImageLightbox().then(() => setLightboxMounted(true))
    }
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(mount)
      return () => w.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(mount, 400)
    return () => window.clearTimeout(id)
  }, [])

  if (slideCount === 0) {
    return (
      <div
        className="relative w-full rounded-2xl bg-[#f5f5f7] text-muted-foreground shadow-sm ring-1 ring-black/[0.04] dark:bg-muted dark:ring-white/[0.06]"
        style={{ paddingBottom: "133.33%" }}
      >
        <span className="absolute inset-0 flex items-center justify-center">No images available</span>
      </div>
    )
  }

  function goPrev() {
    if (emblaApi && canSwipe) {
      emblaApi.scrollPrev()
      return
    }
    setSelectedIndex((prev) => (prev === 0 ? slideCount - 1 : prev - 1))
  }

  function goNext() {
    if (emblaApi && canSwipe) {
      emblaApi.scrollNext()
      return
    }
    setSelectedIndex((prev) => (prev === slideCount - 1 ? 0 : prev + 1))
  }

  function onHeroPointerDown(event: PointerEvent<HTMLDivElement>) {
    pointerStartRef.current = { x: event.clientX, y: event.clientY }
    suppressHeroClickRef.current = false
    void preloadListingImageLightbox().then(() => setLightboxMounted(true))
  }

  function onHeroPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current
    if (!start) return
    if (
      Math.abs(event.clientX - start.x) > HERO_TAP_SLOP_PX ||
      Math.abs(event.clientY - start.y) > HERO_TAP_SLOP_PX
    ) {
      suppressHeroClickRef.current = true
    }
  }

  function onHeroPointerUp() {
    pointerStartRef.current = null
  }

  function openLightbox() {
    if (isVideoSelected || proxiedUrls.length === 0) return
    for (const url of proxiedUrls) warmListingImageSrc(url)
    setLightboxIndex(selectedIndex)
    setLightboxMounted(true)
    setLightboxOpen(true)
  }

  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0 max-w-full",
        compactMobile ? "max-md:space-y-2.5 md:space-y-5" : "space-y-5",
      )}
    >
      {lightboxMounted ? (
        <ListingImageLightbox
          open={lightboxOpen}
          onOpenChange={(o) => {
            setLightboxOpen(o)
            if (o) {
              for (const url of proxiedUrls) warmListingImageSrc(url)
              return
            }
            setSelectedIndex(lightboxIndex)
            setFrameIndex(lightboxIndex)
          }}
          proxiedUrls={proxiedUrls}
          title={title}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          aspectRatios={imageAspectRatios}
          dimensionsLine={dimensionsLine}
          previewUrls={previewUrls}
        />
      ) : null}

      {/* Main Image — tablet/desktop: stable 3:4; phone: edge-to-edge, natural ratio, height-capped */}
      <div
        className={cn(
          compactMobile &&
            "max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] sm:-mx-6 sm:w-[calc(100%+3rem)] md:mx-0 md:w-full",
        )}
      >
        <div
          className={cn(
            "relative overflow-hidden bg-transparent select-none",
            compactMobile
              ? "max-md:h-auto max-md:max-h-[min(58dvh,30rem)] max-md:w-full max-md:min-w-full max-md:[aspect-ratio:var(--hero-aspect,3/4)] max-md:rounded-none md:aspect-[3/4] md:max-h-none md:h-auto md:w-full md:rounded-2xl md:shadow-sm md:ring-1 md:ring-black/[0.04] dark:md:ring-white/[0.06]"
              : "w-full rounded-2xl shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
          )}
          style={
            compactMobile
              ? ({ "--hero-aspect": mobileHeroAspectRatio } as CSSProperties)
              : { paddingBottom: "133.33%" }
          }
        >
        {heroOverlay ? (
          <div className="absolute right-2 top-2 z-[15] flex items-start gap-2 sm:right-3 sm:top-3 md:right-4 md:top-4">
            {heroOverlay}
          </div>
        ) : null}

        {isVideoSelected ? null : (
          <div className="pointer-events-none absolute bottom-3 left-3 z-[8] flex size-8 items-center justify-center rounded-full bg-background/75 text-foreground shadow-sm backdrop-blur-md">
            <Maximize2 className="size-3.5 opacity-70" aria-hidden />
            <span className="sr-only">Enlarge</span>
          </div>
        )}

        <div
          ref={emblaRef}
          className={cn(
            "absolute inset-0 z-[1] overflow-hidden overscroll-x-contain outline-none ring-inset ring-offset-0 transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-ring",
            isVideoSelected ? "cursor-default" : "cursor-zoom-in",
          )}
          role={hasVideo ? undefined : "button"}
          tabIndex={hasVideo ? undefined : 0}
          aria-haspopup={hasVideo ? undefined : "dialog"}
          aria-expanded={hasVideo ? undefined : lightboxOpen}
          aria-label={hasVideo ? undefined : "View enlarged photos"}
          onPointerEnter={() => {
            void preloadListingImageLightbox().then(() => setLightboxMounted(true))
          }}
          onPointerDown={onHeroPointerDown}
          onPointerMove={onHeroPointerMove}
          onPointerUp={onHeroPointerUp}
          onPointerCancel={onHeroPointerUp}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return
            e.preventDefault()
            if (suppressHeroClickRef.current) return
            openLightbox()
          }}
          onClick={() => {
            if (suppressHeroClickRef.current) return
            openLightbox()
          }}
        >
          <div className="flex h-full touch-pan-y will-change-transform backface-hidden">
            {images.map((image, i) => {
              const isSelected = i === selectedIndex
              const slideSrc = previewUrls[i] || heroUrls[i]
              return (
                <div
                  key={image.id || `hero-${i}-${image.url}`}
                  className="relative h-full min-w-0 shrink-0 grow-0 basis-full backface-hidden transform-gpu"
                  style={listingPhotoBackdropStyle(slideSrc)}
                  aria-hidden={!isSelected}
                >
                  <ListingGalleryPhoto
                    src={heroUrls[i] || "/placeholder.svg"}
                    previewSrc={previewUrls[i]}
                    alt={`${title} - Image ${i + 1}`}
                    priority={i === 0 && selectedIndex === 0}
                    fetchPriority={isSelected ? "high" : "auto"}
                    loading="eager"
                    sizes="(max-width: 1024px) 100svw, 50svw"
                    onLoaded={({ naturalWidth, naturalHeight }) => {
                      const ratio = naturalWidth / naturalHeight
                      setImageAspectRatios((prev) => {
                        if (prev[i] === ratio) return prev
                        return { ...prev, [i]: ratio }
                      })
                    }}
                  />
                </div>
              )
            })}
            {hasVideo && video ? (
              <div
                key={video.id || "hero-video"}
                className="relative h-full min-w-0 shrink-0 grow-0 basis-full bg-black"
                aria-hidden={!isVideoSelected}
                onClick={(event) => event.stopPropagation()}
              >
                <ListingPdpVideo
                  video={video}
                  title={title}
                  fill
                  active={isVideoSelected}
                />
              </div>
            ) : null}
          </div>
        </div>
        {sold ? (
          <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-full bg-foreground px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-background">
            Sold
          </div>
        ) : null}

        {slideCount > 1 && !compactMobile && (
          <>
            <ListingImageCarouselNavButton
              direction="prev"
              variant="embed"
              sideClassName="left-3"
              srLabel="Previous slide"
              onClick={(e) => {
                e.stopPropagation()
                goPrev()
              }}
            />
            <ListingImageCarouselNavButton
              direction="next"
              variant="embed"
              sideClassName="right-3"
              srLabel="Next slide"
              onClick={(e) => {
                e.stopPropagation()
                goNext()
              }}
            />
          </>
        )}

        {/* Image counter */}
        {slideCount > 1 && (
          <div className="absolute bottom-3 right-3 z-10 rounded-full bg-background/75 px-2.5 py-1 text-xs font-medium tabular-nums text-foreground backdrop-blur-md">
            {selectedIndex + 1} / {slideCount}
          </div>
        )}
        </div>
      </div>

      {/* Thumbnails - explicit 3:4 box (padding-bottom) so fill Image has a defined size */}
      {slideCount > 1 && (
        <div
          ref={thumbRowRef}
          className={cn(
            "flex max-w-full min-w-0 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]",
            compactMobile ? "gap-1.5 md:gap-2.5" : "gap-2.5",
          )}
        >
          {images.map((image, index) => (
            <button
              key={image.id || `thumb-${index}-${image.url}`}
              type="button"
              data-gallery-thumb={index}
              onClick={() => {
                if (emblaApi && canSwipe) {
                  emblaApi.scrollTo(index)
                  return
                }
                setSelectedIndex(index)
                setFrameIndex(index)
              }}
              aria-label={`Show photo ${index + 1} in gallery`}
              className={cn(
                "flex-shrink-0 overflow-hidden bg-muted transition-[box-shadow,ring-color] duration-200",
                compactMobile ? "rounded-lg md:rounded-2xl" : "rounded-2xl",
                index === selectedIndex
                  ? "ring-[1.5px] ring-offset-2 ring-offset-background ring-foreground/80"
                  : "ring-[0.5px] ring-muted-foreground/25 hover:ring-muted-foreground/45"
              )}
            >
              <span
                className={cn(
                  "listing-tile-shimmer relative block",
                  compactMobile ? "w-11 md:w-16" : "w-16",
                )}
                style={{ paddingBottom: "133.33%" }}
              >
                <span className="absolute inset-0">
                  <ListingGalleryPhoto
                    src={
                      listingTileImageSrcFromRow(image) ||
                      proxiedListingImageSrc(
                        image.thumbnail_url?.trim() || image.url,
                      ) ||
                      "/placeholder.svg"
                    }
                    alt={`${title} - Thumbnail ${index + 1}`}
                    loading={Math.abs(index - selectedIndex) <= 1 ? "eager" : "lazy"}
                    sizes="64px"
                  />
                </span>
              </span>
            </button>
          ))}
          {hasVideo && video ? (
            <button
              key={video.id || "thumb-video"}
              type="button"
              data-gallery-thumb={videoIndex}
              onClick={() => {
                if (emblaApi && canSwipe) {
                  emblaApi.scrollTo(videoIndex)
                  return
                }
                setSelectedIndex(videoIndex)
                setFrameIndex(videoIndex)
              }}
              aria-label="Show video in gallery"
              className={cn(
                "flex-shrink-0 overflow-hidden bg-muted transition-[box-shadow,ring-color] duration-200",
                compactMobile ? "rounded-lg md:rounded-2xl" : "rounded-2xl",
                isVideoSelected
                  ? "ring-[1.5px] ring-offset-2 ring-offset-background ring-foreground/80"
                  : "ring-[0.5px] ring-muted-foreground/25 hover:ring-muted-foreground/45"
              )}
            >
              <span
                className={cn(
                  "listing-tile-shimmer relative block",
                  compactMobile ? "w-11 md:w-16" : "w-16",
                )}
                style={{ paddingBottom: "133.33%" }}
              >
                <span className="absolute inset-0 bg-black">
                  {video.thumbnail_url?.trim() ? (
                    <ListingGalleryPhoto
                      src={
                        proxiedListingImageSrc(video.thumbnail_url) ||
                        video.thumbnail_url
                      }
                      alt={`${title} - Video thumbnail`}
                      loading={isVideoSelected ? "eager" : "lazy"}
                      sizes="64px"
                    />
                  ) : null}
                  <span className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-black/30">
                    <Play className="size-3.5 fill-white text-white" aria-hidden />
                  </span>
                </span>
              </span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}
