"use client"

import Image from "next/image"
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEventHandler,
  type ReactNode,
  type SyntheticEvent,
} from "react"
import { ListingImageCarouselNavButton } from "@/components/features/listings/listing-image-carousel-nav-button"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { cn } from "@/lib/utils"

const hoverRevealNav =
  "opacity-0 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 [@media(pointer:coarse)]:pointer-events-auto [@media(pointer:coarse)]:opacity-100 has-[:focus-visible]:pointer-events-auto has-[:focus-visible]:opacity-100"

function carouselSlideNearActive(i: number, active: number, total: number): boolean {
  if (total <= 1) return true
  if (i === active) return true
  if (i === (active + 1) % total) return true
  if (i === (active - 1 + total) % total) return true
  return false
}

function ListingTileCarouselSlide({
  candidates,
  active,
  imageSizes,
  imageFit,
  imageClassName,
  imagePriority,
  onLoadedChange,
  onExhausted,
}: {
  candidates: string[]
  active: boolean
  imageSizes: string
  imageFit: "cover" | "contain"
  imageClassName?: string
  imagePriority?: boolean
  onLoadedChange: (loaded: boolean) => void
  onExhausted: () => void
}) {
  const [candidateIndex, setCandidateIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)

  const candidatesKey = candidates.join("|")

  useEffect(() => {
    setCandidateIndex(0)
    setLoaded(false)
  }, [candidatesKey])

  useEffect(() => {
    if (active) {
      onLoadedChange(loaded)
    }
  }, [active, loaded, onLoadedChange])

  const src = candidates[candidateIndex] ?? ""

  useEffect(() => {
    if (!src && candidates.length === 0) {
      onExhausted()
    }
  }, [src, candidates.length, onExhausted])

  const handleLoad = useCallback(
    (_event: SyntheticEvent<HTMLImageElement>) => {
      setLoaded(true)
    },
    [],
  )

  const handleError = useCallback(
    (_event: SyntheticEvent<HTMLImageElement>) => {
      setLoaded(false)
      if (candidateIndex + 1 < candidates.length) {
        setCandidateIndex((index) => index + 1)
        return
      }
      onExhausted()
    },
    [candidateIndex, candidates.length, onExhausted],
  )

  if (!src) return null

  const objectStyle =
    imageFit === "contain"
      ? ({ objectFit: "contain" } as const)
      : ({ objectFit: "cover" } as const)

  return (
    <Image
      key={src}
      src={src}
      alt=""
      fill
      sizes={imageSizes}
      quality={90}
      unoptimized={listingImageShouldBypassOptimization(src)}
      aria-hidden={!active}
      loading={imagePriority && active ? "eager" : "lazy"}
      className={cn(
        "absolute inset-0 transition-opacity duration-[280ms] ease-in-out",
        active ? "z-[2] opacity-100" : "z-[1] opacity-0",
        "transition-transform duration-300 group-hover:scale-105",
        imageFit === "cover" && "object-cover",
        imageFit === "contain" && "object-contain",
        imageClassName,
      )}
      style={objectStyle}
      ref={(img) => {
        if (img?.complete && img.naturalWidth > 0) {
          setLoaded(true)
        }
      }}
      onLoad={handleLoad}
      onError={handleError}
      priority={imagePriority && active}
    />
  )
}

export interface ListingTileImageMediaProps {
  /** Ordered URL fallbacks per carousel slide (primary photo first). */
  slideCandidates: string[][]
  imageAlt: string
  imageSizes: string
  aspectClass: string
  imageAspect: "portrait" | "square"
  linkLayoutUnified: boolean
  imageFit: "cover" | "contain"
  imageClassName?: string
  overlayTopLeft?: ReactNode
  overlayBottomRight?: ReactNode
  overlayFull?: ReactNode
  /**
   * Set to true only on tiles that are genuinely above the fold on first paint (e.g. the first
   * 1–2 tiles in a grid). Enables `fetchpriority="high"` + a `<link rel="preload">` hint.
   * Defaults to false — every tile without this flag gets native lazy loading for free.
   */
  imagePriority?: boolean
}

/** Listing tile imagery — wave shimmer overlay while photos load (default for all {@link ListingTile} usage). */
export function ListingTileImageMedia({
  slideCandidates,
  imageAlt,
  imageSizes,
  aspectClass,
  imageAspect,
  linkLayoutUnified,
  imageFit,
  imageClassName,
  overlayTopLeft,
  overlayBottomRight,
  overlayFull,
  imagePriority = false,
}: ListingTileImageMediaProps) {
  const [index, setIndex] = useState(0)
  const [exhaustedSlides, setExhaustedSlides] = useState<Set<number>>(() => new Set())
  const [activeLoaded, setActiveLoaded] = useState(false)
  const [prefetchNeighbors, setPrefetchNeighbors] = useState(false)

  const slidesKey = slideCandidates.map((candidates) => candidates.join("|")).join("||")

  useEffect(() => {
    setIndex(0)
    setExhaustedSlides(new Set())
    setActiveLoaded(false)
    setPrefetchNeighbors(false)
  }, [slidesKey])

  const visibleSlides = useMemo(
    () =>
      slideCandidates
        .map((candidates, slideIndex) => ({ candidates, slideIndex }))
        .filter(({ slideIndex }) => !exhaustedSlides.has(slideIndex)),
    [slideCandidates, exhaustedSlides],
  )

  const count = visibleSlides.length

  useEffect(() => {
    if (count === 0) {
      setIndex(0)
      return
    }
    if (index >= count) {
      setIndex(0)
    }
  }, [count, index])

  const mountedSlideIndices = useMemo(() => {
    if (count <= 1) return [0]
    const indices = new Set<number>([index])
    if (prefetchNeighbors) {
      for (let i = 0; i < count; i += 1) {
        if (carouselSlideNearActive(i, index, count)) indices.add(i)
      }
    }
    return [...indices].sort((a, b) => a - b)
  }, [count, index, prefetchNeighbors])

  const handleActiveLoadedChange = useCallback((loaded: boolean) => {
    setActiveLoaded(loaded)
  }, [])

  const markSlideExhausted = useCallback((slideIndex: number) => {
    setExhaustedSlides((prev) => {
      if (prev.has(slideIndex)) return prev
      const next = new Set(prev)
      next.add(slideIndex)
      return next
    })
  }, [])

  const goPrev = useCallback<MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (count <= 1) return
      setPrefetchNeighbors(true)
      setIndex((i) => (i === 0 ? count - 1 : i - 1))
      setActiveLoaded(false)
    },
    [count],
  )

  const goNext = useCallback<MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (count <= 1) return
      setPrefetchNeighbors(true)
      setIndex((i) => (i === count - 1 ? 0 : i + 1))
      setActiveLoaded(false)
    },
    [count],
  )

  const hasImage = count > 0
  const showImageShimmer = hasImage && !activeLoaded

  return (
    <div
      className={cn(
        aspectClass,
        "relative w-full overflow-hidden bg-muted",
        imageAspect === "portrait" && linkLayoutUnified && "shrink-0 rounded-t-xl",
        imageAspect === "square" && linkLayoutUnified && "rounded-t-xl",
      )}
      aria-label={imageAlt}
      onPointerEnter={() => setPrefetchNeighbors(true)}
      onFocusCapture={() => setPrefetchNeighbors(true)}
    >
      {hasImage ? (
        mountedSlideIndices.map((visibleIndex) => {
          const slide = visibleSlides[visibleIndex]
          if (!slide) return null
          const active = visibleIndex === index
          return (
            <ListingTileCarouselSlide
              key={`${slide.slideIndex}-${slide.candidates.join("|")}`}
              candidates={slide.candidates}
              active={active}
              imageSizes={imageSizes}
              imageFit={imageFit}
              imageClassName={imageClassName}
              imagePriority={imagePriority && visibleIndex === 0}
              onLoadedChange={handleActiveLoadedChange}
              onExhausted={() => markSlideExhausted(slide.slideIndex)}
            />
          )
        })
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          No Image
        </div>
      )}

      {hasImage ? (
        <div
          className={cn(
            "listing-tile-shimmer listing-tile-shimmer-overlay absolute inset-0 z-[3]",
            !showImageShimmer && "pointer-events-none opacity-0",
          )}
          aria-hidden
        />
      ) : null}

      {[
        overlayTopLeft != null ? (
          <Fragment key="listing-tile-overlay-tl">{overlayTopLeft}</Fragment>
        ) : null,
        overlayBottomRight != null ? (
          <Fragment key="listing-tile-overlay-br">{overlayBottomRight}</Fragment>
        ) : null,
        count > 1 ? (
          <Fragment key="listing-tile-carousel-nav">
            <span
              className={cn(
                "absolute inset-y-0 left-0 z-20 hidden items-center pr-8 md:flex",
                hoverRevealNav,
              )}
            >
              <ListingImageCarouselNavButton
                direction="prev"
                variant="lightbox"
                sideClassName="left-2"
                srLabel="Previous listing photo"
                onClick={goPrev}
              />
            </span>
            <span
              className={cn(
                "absolute inset-y-0 right-0 z-20 hidden items-center pl-8 md:flex",
                hoverRevealNav,
              )}
            >
              <ListingImageCarouselNavButton
                direction="next"
                variant="lightbox"
                sideClassName="right-2"
                srLabel="Next listing photo"
                onClick={goNext}
              />
            </span>
          </Fragment>
        ) : null,
        overlayFull != null ? (
          <Fragment key="listing-tile-overlay-full">{overlayFull}</Fragment>
        ) : null,
      ].filter((n) => n != null)}
    </div>
  )
}
