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
} from "react"
import { ListingImageCarouselNavButton } from "@/components/features/listings/listing-image-carousel-nav-button"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { cn } from "@/lib/utils"

const hoverRevealNav =
  "opacity-0 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 [@media(pointer:coarse)]:pointer-events-auto [@media(pointer:coarse)]:opacity-100 has-[:focus-visible]:pointer-events-auto has-[:focus-visible]:opacity-100"

export interface ListingTileImageMediaProps {
  urls: string[]
  imageAlt: string
  imageSizes: string
  aspectClass: string
  imageAspect: "portrait" | "square"
  linkLayoutUnified: boolean
  imageFit: "cover" | "contain"
  imageClassName?: string
  overlayTopLeft?: ReactNode
  /** Corner overlay (e.g. favorites). Position comes from the overlay root (top-right on cards). */
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
  urls,
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
  const [loadedByUrl, setLoadedByUrl] = useState<Record<string, true>>({})
  const [failedByUrl, setFailedByUrl] = useState<Record<string, true>>({})

  const markImageLoaded = useCallback((url: string) => {
    setLoadedByUrl((prev) => (prev[url] ? prev : { ...prev, [url]: true }))
  }, [])

  const handleImageError = useCallback(
    (url: string) => () => {
      setFailedByUrl((prev) => (prev[url] ? prev : { ...prev, [url]: true }))
      markImageLoaded(url)
    },
    [markImageLoaded],
  )

  const visibleUrls = useMemo(
    () => urls.filter((url) => url && !failedByUrl[url]),
    [failedByUrl, urls],
  )
  const count = visibleUrls.length

  useEffect(() => {
    if (count === 0) return
    if (index >= count) {
      setIndex(0)
    }
  }, [count, index])

  const goPrev = useCallback<MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (count <= 1) return
      setIndex((i) => (i === 0 ? count - 1 : i - 1))
    },
    [count],
  )

  const goNext = useCallback<MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (count <= 1) return
      setIndex((i) => (i === count - 1 ? 0 : i + 1))
    },
    [count],
  )

  const objectStyle =
    imageFit === "contain"
      ? ({ objectFit: "contain" } as const)
      : ({ objectFit: "cover" } as const)

  const hasImage = count > 0
  const activeUrl = visibleUrls[index] ?? ""
  const showImageShimmer = hasImage && !loadedByUrl[activeUrl]

  return (
    <div
      className={cn(
        aspectClass,
        "relative w-full overflow-hidden bg-muted",
        imageAspect === "portrait" && linkLayoutUnified && "shrink-0 rounded-t-xl",
        imageAspect === "square" && linkLayoutUnified && "rounded-t-xl",
      )}
    >
      {hasImage ? (
        visibleUrls.map((u, i) => {
          if (!u) return null
          const active = i === index
          return (
            <Image
              key={`${u}-${i}`}
              src={u}
              alt={`${imageAlt}${count > 1 ? ` (${i + 1} of ${count})` : ""}`}
              fill
              sizes={imageSizes}
              quality={90}
              unoptimized={listingImageShouldBypassOptimization(u)}
              aria-hidden={!active}
              loading={active ? "eager" : "lazy"}
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
                // Images cached/loaded before hydration never re-fire `load`;
                // without this the shimmer overlay stays on top forever.
                if (img?.complete && !img.naturalWidth) {
                  handleImageError(u)()
                  return
                }
                if (img?.complete) markImageLoaded(u)
              }}
              onLoad={(event) => {
                if (event.currentTarget.naturalWidth === 0) {
                  handleImageError(u)()
                  return
                }
                markImageLoaded(u)
              }}
              onError={handleImageError(u)}
              priority={imagePriority && i === 0 && index === 0}
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
