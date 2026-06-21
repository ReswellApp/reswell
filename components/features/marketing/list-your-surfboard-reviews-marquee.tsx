"use client"

import * as React from "react"
import Image from "next/image"
import { ImageOff } from "lucide-react"
import { SellerRatingStarRow } from "@/components/seller-rating-stars"
import { Badge } from "@/components/ui/badge"
import type {
  MarketplaceShowcaseReviewRole,
  MarketplaceShowcaseReviewRow,
} from "@/lib/db/marketplace-reviews-showcase"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { truncateReviewText } from "@/lib/reswell-platform-review-stats"
import { cn } from "@/lib/utils"
import { ListYourSurfboardReviewDialog } from "@/components/features/marketing/list-your-surfboard-review-dialog"

const ROLE_LABEL: Record<MarketplaceShowcaseReviewRole, string> = {
  buyer: "Buyer",
  seller: "Seller",
}

const SCROLL_SPEED_PX = 0.45

function ReviewListingThumb({
  imageSrc,
  title,
  mobileOneScreen = false,
}: {
  imageSrc: string | null
  title: string | null
  mobileOneScreen?: boolean
}) {
  const alt = title?.trim() || "Reviewed listing"

  return (
    <div
      data-lys-review-thumb={mobileOneScreen ? true : undefined}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border/60",
        mobileOneScreen ? "h-9 w-9" : "h-11 w-11",
        mobileOneScreen && "max-lg:aspect-square max-lg:h-auto max-lg:w-auto",
      )}
    >
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt={alt}
          fill
          className="object-cover"
          sizes={mobileOneScreen ? "36px" : "44px"}
          unoptimized={listingImageShouldBypassOptimization(imageSrc)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageOff className="h-4 w-4" aria-hidden />
        </div>
      )}
    </div>
  )
}

function normalizeMarqueeScroll(el: HTMLDivElement) {
  const loopWidth = el.scrollWidth / 2
  if (loopWidth <= 0) return
  while (el.scrollLeft >= loopWidth) el.scrollLeft -= loopWidth
  while (el.scrollLeft < 0) el.scrollLeft += loopWidth
}

function CompactReviewMarqueeTile({
  review,
  onOpen,
  mobileOneScreen = false,
}: {
  review: MarketplaceShowcaseReviewRow
  onOpen: (review: MarketplaceShowcaseReviewRow) => void
  mobileOneScreen?: boolean
}) {
  const { text } = truncateReviewText(review.comment, mobileOneScreen ? 64 : 80)

  return (
    <button
      type="button"
      onClick={() => onOpen(review)}
      onPointerDown={(event) => event.stopPropagation()}
      className={cn(
        "flex w-[228px] shrink-0 cursor-pointer items-center gap-2.5 rounded-lg border border-border/70 bg-card px-2.5 py-2 text-left shadow-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-[248px]",
        mobileOneScreen && "max-lg:gap-[var(--lys-fold-gap,0.5rem)]",
      )}
      data-lys-review-tile={mobileOneScreen ? true : undefined}
    >
      <div className="shrink-0">
        <ReviewListingThumb
          imageSrc={review.listingImageSrc}
          title={review.listingTitle}
          mobileOneScreen={mobileOneScreen}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div aria-label={`${review.rating} out of 5 stars`}>
            <SellerRatingStarRow value={review.rating} size={mobileOneScreen ? "sm" : "md"} />
          </div>
          <Badge
            variant="secondary"
            className={cn(
              "shrink-0 uppercase tracking-wide",
              mobileOneScreen
                ? "h-4 px-1 text-[9px]"
                : "h-[18px] px-1.5 text-[10px]",
            )}
          >
            {ROLE_LABEL[review.role]}
          </Badge>
        </div>
        <p
          data-lys-review-name={mobileOneScreen ? true : undefined}
          className={cn(
            "mt-1 truncate font-semibold text-foreground",
            !mobileOneScreen && "text-xs",
          )}
        >
          {review.reviewerLabel}
        </p>
        <p
          data-lys-review-body={mobileOneScreen ? true : undefined}
          className={cn(
            "leading-snug text-muted-foreground",
            mobileOneScreen ? "line-clamp-1" : "line-clamp-2 text-[11px]",
          )}
        >
          {text}
        </p>
      </div>
    </button>
  )
}

type ListYourSurfboardReviewsMarqueeProps = {
  reviews: MarketplaceShowcaseReviewRow[]
  className?: string
  mobileOneScreen?: boolean
}

export function ListYourSurfboardReviewsMarquee({
  reviews,
  className,
  mobileOneScreen = false,
}: ListYourSurfboardReviewsMarqueeProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const isInteractingRef = React.useRef(false)
  const dragRef = React.useRef<{ active: boolean; startX: number; startScroll: number }>({
    active: false,
    startX: 0,
    startScroll: 0,
  })
  const [reduceMotion, setReduceMotion] = React.useState(false)
  const [isInteracting, setIsInteracting] = React.useState(false)
  const [selectedReview, setSelectedReview] = React.useState<MarketplaceShowcaseReviewRow | null>(
    null,
  )

  const openReview = React.useCallback((review: MarketplaceShowcaseReviewRow) => {
    setSelectedReview(review)
  }, [])

  const setInteracting = React.useCallback((value: boolean) => {
    isInteractingRef.current = value
    setIsInteracting(value)
  }, [])

  React.useLayoutEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  const minTiles = Math.max(reviews.length * 2, 10)
  const repeatedReviews: MarketplaceShowcaseReviewRow[] = []
  while (repeatedReviews.length < minTiles) {
    repeatedReviews.push(...reviews)
  }
  const loopReviews = reduceMotion
    ? reviews
    : [...repeatedReviews, ...repeatedReviews]

  React.useEffect(() => {
    if (reduceMotion || reviews.length === 0) return

    let raf = 0
    const tick = () => {
      const el = scrollRef.current
      if (el && !isInteractingRef.current) {
        el.scrollLeft += SCROLL_SPEED_PX
        normalizeMarqueeScroll(el)
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduceMotion, reviews.length, loopReviews.length])

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onWheel = (event: WheelEvent) => {
      if (!isInteractingRef.current) return

      const absX = Math.abs(event.deltaX)
      const absY = Math.abs(event.deltaY)
      if (absY <= absX || absY === 0) return

      event.preventDefault()
      el.scrollLeft += event.deltaY
      normalizeMarqueeScroll(el)
    }

    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  const handleScroll = React.useCallback(() => {
    const el = scrollRef.current
    if (!el || reduceMotion) return
    normalizeMarqueeScroll(el)
  }, [reduceMotion])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const el = scrollRef.current
    if (!el) return

    setInteracting(true)
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startScroll: el.scrollLeft,
    }
    el.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current
    if (!el || !dragRef.current.active) return

    const deltaX = event.clientX - dragRef.current.startX
    if (Math.abs(deltaX) > 3) {
      event.preventDefault()
    }

    el.scrollLeft = dragRef.current.startScroll - deltaX
    normalizeMarqueeScroll(el)
  }

  const endPointerInteraction = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current
    dragRef.current.active = false
    if (el?.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId)
    }
  }

  if (reviews.length === 0) return null

  return (
    <>
      <section
        aria-label="Reviews from buyers and sellers"
        data-lys-reviews={mobileOneScreen ? true : undefined}
        className={cn(
          "shrink-0 border-b border-border/60 bg-background pb-1.5 pt-2.5",
          mobileOneScreen && "max-lg:overflow-visible",
          className,
        )}
      >
        <div
          ref={scrollRef}
          className={cn(
            "overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            isInteracting && "cursor-grab active:cursor-grabbing",
          )}
          onMouseEnter={() => setInteracting(true)}
          onMouseLeave={() => {
            dragRef.current.active = false
            setInteracting(false)
          }}
          onFocus={() => setInteracting(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              dragRef.current.active = false
              setInteracting(false)
            }
          }}
          onTouchStart={() => setInteracting(true)}
          onTouchEnd={() => setInteracting(false)}
          onScroll={handleScroll}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointerInteraction}
          onPointerCancel={endPointerInteraction}
        >
          <div className={cn("flex w-max gap-2.5 px-4 sm:px-6", mobileOneScreen && "max-lg:gap-2 max-lg:px-3")}>
            {loopReviews.map((review, index) => (
              <CompactReviewMarqueeTile
                key={`${review.id}-${index}`}
                review={review}
                onOpen={openReview}
                mobileOneScreen={mobileOneScreen}
              />
            ))}
          </div>
        </div>
      </section>

      <ListYourSurfboardReviewDialog
        review={selectedReview}
        open={selectedReview != null}
        onOpenChange={(open) => {
          if (!open) setSelectedReview(null)
        }}
      />
    </>
  )
}
