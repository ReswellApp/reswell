"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { HomeListingScrollRow } from "@/components/features/home/home-listing-scroll-row"
import { blogImageShouldBypassOptimization } from "@/lib/blog/blog-media-proxy-url"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import type { ListingRelatedContentCard } from "@/lib/listing-related-content"
import { cn } from "@/lib/utils"

const TILE_WRAP_CLASS =
  "flex min-h-0 w-[min(18.5rem,78svw)] shrink-0 snap-start flex-col self-stretch sm:w-[20rem] lg:w-[21.5rem]"

export function ListingRelatedContentCarousel({
  items,
}: {
  items: ListingRelatedContentCard[]
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)

  function scrollNext() {
    const root = scrollerRef.current
    if (!root) return
    const scroller = root.querySelector<HTMLElement>("[class*='overflow-x-auto']")
    if (!scroller) return
    scroller.scrollBy({ left: Math.min(scroller.clientWidth * 0.85, 360), behavior: "smooth" })
  }

  return (
    <div ref={scrollerRef}>
      <div className="mb-8 flex items-center justify-between gap-4">
        <h2
          id="listing-related-content"
          className="text-2xl font-bold text-foreground"
        >
          Related content
        </h2>
        {items.length > 2 ? (
          <button
            type="button"
            onClick={scrollNext}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-muted"
            aria-label="Show more related content"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>
      <HomeListingScrollRow uniformCardHeights tileWrapClassName={TILE_WRAP_CLASS} rowGapClassName="gap-5">
        {items.map((item) => (
          <RelatedContentCard key={item.id} item={item} />
        ))}
      </HomeListingScrollRow>
    </div>
  )
}

function RelatedContentTileImage({ src }: { src: string }) {
  const [isPortrait, setIsPortrait] = useState<boolean | null>(null)

  useEffect(() => {
    setIsPortrait(null)
  }, [src])

  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted">
      <div
        className={cn(
          "absolute",
          isPortrait
            ? "left-1/2 top-1/2 h-[160%] w-[62.5%] -translate-x-1/2 -translate-y-1/2 rotate-90"
            : "inset-0",
        )}
      >
        <Image
          src={src}
          alt=""
          fill
          unoptimized={
            listingImageShouldBypassOptimization(src) || blogImageShouldBypassOptimization(src)
          }
          sizes="(max-width: 640px) 78svw, 344px"
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget
            if (naturalWidth <= 0 || naturalHeight <= 0) return
            setIsPortrait(naturalHeight > naturalWidth)
          }}
          className={cn(
            "object-cover transition-opacity duration-300 group-hover:opacity-90",
            isPortrait === null && "opacity-0",
          )}
        />
      </div>
    </div>
  )
}

function RelatedContentCard({ item }: { item: ListingRelatedContentCard }) {
  const imageUrl = item.imageUrl?.trim() || null

  return (
    <article className="flex h-full min-w-0 flex-col">
      <Link href={item.href} className="group flex h-full min-w-0 flex-col no-underline">
        {imageUrl ? <RelatedContentTileImage src={imageUrl} /> : null}
        <p
          className={
            imageUrl
              ? "mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
              : "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
          }
        >
          {item.label}
        </p>
        <h3 className="mt-1.5 text-balance font-headline text-lg font-semibold leading-snug tracking-tight text-foreground group-hover:text-foreground/80">
          {item.title}
        </h3>
      </Link>
    </article>
  )
}
