"use client"

import Image from "next/image"
import {
  Fragment,
  useCallback,
  useState,
  type MouseEventHandler,
  type ReactNode,
} from "react"
import { ListingImageCarouselNavButton } from "@/components/features/listings/listing-image-carousel-nav-button"
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
  useBlurPlaceholder: boolean
  blurDataURL: string
  imageFit: "cover" | "contain"
  imageClassName?: string
  imageGrayscale?: boolean
  overlayTopLeft?: ReactNode
  overlayTopRight?: ReactNode
  overlayFull?: ReactNode
}

export function ListingTileImageMedia({
  urls,
  imageAlt,
  imageSizes,
  aspectClass,
  imageAspect,
  linkLayoutUnified,
  useBlurPlaceholder,
  blurDataURL,
  imageFit,
  imageClassName,
  imageGrayscale,
  overlayTopLeft,
  overlayTopRight,
  overlayFull,
}: ListingTileImageMediaProps) {
  const count = urls.length
  const [index, setIndex] = useState(0)

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
        urls.map((u, i) => {
          const active = i === index
          return (
            <Image
              key={`${u}-${i}`}
              src={u}
              alt={`${imageAlt}${count > 1 ? ` (${i + 1} of ${count})` : ""}`}
              fill
              sizes={imageSizes}
              quality={90}
              aria-hidden={!active}
              className={cn(
                "absolute inset-0 transition-opacity duration-[280ms] ease-in-out",
                active ? "z-[2] opacity-100" : "z-[1] opacity-0",
                "transition-transform duration-300 group-hover:scale-105",
                imageFit === "cover" && "object-cover",
                imageFit === "contain" && "object-contain",
                imageGrayscale && "[filter:grayscale(30%)]",
                imageClassName,
              )}
              style={objectStyle}
              {...(useBlurPlaceholder ? { placeholder: "blur" as const, blurDataURL } : {})}
              priority={i === 0}
            />
          )
        })
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          No Image
        </div>
      )}

      {[
        overlayTopLeft != null ? (
          <Fragment key="listing-tile-overlay-tl">{overlayTopLeft}</Fragment>
        ) : null,
        overlayTopRight != null ? (
          <Fragment key="listing-tile-overlay-tr">{overlayTopRight}</Fragment>
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
