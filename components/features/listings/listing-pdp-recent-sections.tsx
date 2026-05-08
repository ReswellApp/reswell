"use client"

import type { ReactNode } from "react"
import { useLayoutEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ShieldCheck, Truck } from "lucide-react"
import { FavoriteButtonCardOverlay } from "@/components/favorite-button-card-overlay"
import { boardFulfillmentSummary } from "@/lib/listing-fulfillment"
import { listingDetailHref } from "@/lib/listing-href"
import { listingCardImageSrc } from "@/lib/listing-image-display"
import {
  capitalizeWords,
  formatBoardType,
  formatCondition,
  formatListingTileCategoryPillText,
} from "@/lib/listing-labels"
import type { PdpRecentStripListingWithFavorite } from "@/lib/pdp-recent-strip-listing"
import {
  pushRecentSurfboardListingId,
  readRecentSurfboardListingIds,
} from "@/lib/utils/recent-viewed-surfboards-storage"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

function catalogBrandLabel(listing: PdpRecentStripListingWithFavorite): string {
  const b = listing.brand?.trim()
  if (b) return b.toUpperCase()
  const title = listing.title.trim()
  const first = title.split(/\s+/)[0] ?? ""
  return first ? first.toUpperCase() : "BOARD"
}

/** Hard cap (~280px): keeps sparse PDP “recent” rows from growing with the viewport. */
function recentStripCardMaxWidthClass() {
  return "max-w-[min(100%,17.5rem)]"
}

function recentStripImageSizes(tilesInRow: number): string {
  if (tilesInRow <= 1) return "(max-width: 640px) 92vw, 280px"
  if (tilesInRow === 2) return "(max-width: 640px) 46vw, 280px"
  if (tilesInRow === 3) return "(max-width: 640px) 80vw, 200px"
  if (tilesInRow === 4) return "(max-width: 640px) 70vw, 180px"
  if (tilesInRow === 5) return "(max-width: 640px) 65vw, 160px"
  return "(max-width: 640px) 60vw, 150px"
}

function PdpRecentHorizontalStrip({ tileCount, children }: { tileCount: number; children: ReactNode }) {
  const sparse = tileCount <= 2
  return (
    <div className="relative left-1/2 w-[calc(100vw-1.25rem)] max-w-[calc(100vw-1.25rem)] -translate-x-1/2 sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] lg:w-[calc(100vw-2.5rem)] lg:max-w-[calc(100vw-2.5rem)]">
      <div
        className={cn(
          "flex gap-3 px-4 pb-2 sm:gap-4 sm:px-6 lg:px-8",
          sparse
            ? cn("w-full flex-row items-stretch", tileCount === 1 && "justify-center")
            : "w-full flex-nowrap overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] sm:overflow-x-visible [&::-webkit-scrollbar]:hidden",
        )}
      >
        {children}
      </div>
    </div>
  )
}

function PdpRecentCatalogCard({
  listing,
  tilesInRow,
  sparseRow,
}: {
  listing: PdpRecentStripListingWithFavorite
  tilesInRow: number
  sparseRow: boolean
}) {
  const href = listingDetailHref({
    id: listing.id,
    slug: listing.slug,
    section: listing.section,
  })
  const src = listingCardImageSrc(listing.listing_images)
  const typeLabel = formatListingTileCategoryPillText(listing) ?? formatBoardType(listing.board_type)
  const crumb = typeLabel ? `Surfboards > ${typeLabel}` : "Surfboards"
  const price = listing.price

  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-0 flex-col",
        recentStripCardMaxWidthClass(),
        tilesInRow === 1 && "mx-auto w-full",
        sparseRow && tilesInRow >= 2 && "w-full flex-1 basis-0 sm:w-auto",
        !sparseRow &&
          "w-[min(100%,260px)] shrink-0 snap-start sm:w-auto sm:min-w-0 sm:flex-1 sm:basis-0 sm:snap-none",
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/40 bg-card shadow-sm transition-shadow hover:shadow-md dark:border-border dark:bg-muted/20">
        <div className="relative aspect-[3/4] w-full min-h-[112px] shrink-0 overflow-hidden bg-muted sm:min-h-[128px]">
          {src ? (
            <Image
              src={src}
              alt={capitalizeWords(listing.title)}
              fill
              className="object-cover object-center"
              sizes={recentStripImageSizes(tilesInRow)}
            />
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {catalogBrandLabel(listing)}
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-foreground sm:line-clamp-3">
            {capitalizeWords(listing.title)}
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{crumb}</p>
          <p className="mt-auto pt-3 text-[11px] font-medium text-muted-foreground">
            From <span className="tabular-nums text-foreground">${price.toFixed(2)}</span>
          </p>
        </div>
      </div>
    </Link>
  )
}

function PdpRecentStripSkeleton({
  titleSkeletonClass: titleClass,
  tileCount,
}: {
  titleSkeletonClass: string
  tileCount: number
}) {
  const sparse = tileCount <= 2
  return (
    <section
      className="min-w-0 w-full border-t border-neutral-200/90 pt-12 dark:border-neutral-700/70"
      role="status"
      aria-busy="true"
      aria-label="Loading recently viewed"
    >
      <div className="mb-8 px-4 sm:px-6 lg:px-8">
        <Skeleton className={cn("h-9", titleClass)} />
      </div>
      <div className="relative left-1/2 w-[calc(100vw-1.25rem)] max-w-[calc(100vw-1.25rem)] -translate-x-1/2 sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] lg:w-[calc(100vw-2.5rem)] lg:max-w-[calc(100vw-2.5rem)]">
        <div
          className={cn(
            "flex gap-3 px-4 pb-2 sm:gap-4 sm:px-6 lg:px-8",
            sparse
              ? cn("w-full flex-row items-stretch", tileCount === 1 && "justify-center")
              : "w-full flex-nowrap overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] sm:overflow-x-visible [&::-webkit-scrollbar]:hidden",
          )}
        >
          {Array.from({ length: tileCount }, (_, i) => (
            <div
              key={i}
              className={cn(
                "flex min-h-0 flex-col",
                recentStripCardMaxWidthClass(),
                tileCount === 1 && "mx-auto w-full",
                sparse && tileCount >= 2 && "w-full flex-1 basis-0 sm:w-auto",
                !sparse &&
                  "w-[min(100%,260px)] shrink-0 snap-start sm:w-auto sm:min-w-0 sm:flex-1 sm:basis-0 sm:snap-none",
              )}
            >
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/40 bg-card shadow-sm dark:border-border dark:bg-muted/20">
                <Skeleton className="aspect-[3/4] w-full min-h-[112px] shrink-0 rounded-none sm:min-h-[128px]" />
                <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 pb-3 pt-3">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-4 w-full max-w-[min(100%,14rem)]" />
                  <Skeleton className="h-3 w-[85%] max-w-[min(100%,12rem)]" />
                  <Skeleton className="mt-auto h-3 w-24 pt-2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PdpRecentMarketplaceCard({
  listing,
  viewerUserId,
  tilesInRow,
  sparseRow,
}: {
  listing: PdpRecentStripListingWithFavorite
  viewerUserId: string | null
  tilesInRow: number
  sparseRow: boolean
}) {
  const href = listingDetailHref({
    id: listing.id,
    slug: listing.slug,
    section: listing.section,
  })
  const src = listingCardImageSrc(listing.listing_images)
  const condition = formatCondition(listing.condition)
  const fulfill = boardFulfillmentSummary(listing.local_pickup, listing.shipping_available)

  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-0 flex-col",
        recentStripCardMaxWidthClass(),
        tilesInRow === 1 && "mx-auto w-full",
        sparseRow && tilesInRow >= 2 && "w-full flex-1 basis-0 sm:w-auto",
        !sparseRow &&
          "w-[min(100%,260px)] shrink-0 snap-start sm:w-auto sm:min-w-0 sm:flex-1 sm:basis-0 sm:snap-none",
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow duration-200 hover:shadow-md">
        <div className="relative aspect-[3/4] w-full min-h-[112px] shrink-0 overflow-hidden bg-muted sm:min-h-[128px]">
          {src ? (
            <Image
              src={src}
              alt={capitalizeWords(listing.title)}
              fill
              className="object-cover object-center transition-transform duration-200 group-hover:scale-[1.02]"
              sizes={recentStripImageSizes(tilesInRow)}
            />
          ) : null}
          <FavoriteButtonCardOverlay
            listingId={listing.id}
            initialFavorited={listing.viewerFavorited}
            isLoggedIn={!!viewerUserId}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-3 pt-3">
          <h3 className="line-clamp-3 text-sm font-semibold leading-snug text-foreground">
            {capitalizeWords(listing.title)}
          </h3>
          {condition ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {listing.condition === "brand_new" ? "New" : `Used – ${condition}`}
            </p>
          ) : null}
          <p className="mt-2 text-base font-bold tabular-nums text-foreground">${listing.price.toFixed(2)}</p>
          <div className="mt-auto space-y-1.5 pt-2">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Truck className="h-3.5 w-3.5 shrink-0 text-foreground/70" aria-hidden />
              <span>{fulfill}</span>
            </p>
            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/70" aria-hidden />
              <span>Purchase Protection on eligible checkout</span>
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}

export function ListingPdpRecentSections({
  currentListingId,
  viewerUserId,
  moreListings,
  padStripWithRecommendations = true,
}: {
  currentListingId: string
  viewerUserId: string | null
  moreListings: PdpRecentStripListingWithFavorite[]
  /**
   * When false (e.g. short `/l/*` PDP URLs), only listing IDs from local “recently viewed”
   * are shown — no filler tiles from `moreListings`. Also omits the separate catalog-style
   * strip so a single “Recently viewed” row matches marketplace cards.
   */
  padStripWithRecommendations?: boolean
}) {
  const [catalogRow, setCatalogRow] = useState<PdpRecentStripListingWithFavorite[] | null>(null)
  const [marketRow, setMarketRow] = useState<PdpRecentStripListingWithFavorite[] | null>(null)
  const [recentUi, setRecentUi] = useState<
    | { phase: "idle" }
    | {
        phase: "skeleton"
        skeletonCatalog: boolean
        skeletonMarketTileCount: number
        skeletonCatalogTileCount: number
      }
    | { phase: "content" }
  >({ phase: "idle" })

  useLayoutEffect(() => {
    pushRecentSurfboardListingId(currentListingId)

    let cancelled = false
    const byId = new Map<string, PdpRecentStripListingWithFavorite>()
    for (const row of moreListings) {
      byId.set(row.id, row)
    }

    const recent = readRecentSurfboardListingIds().filter((id) => id !== currentListingId)
    const recent6 = recent.slice(0, 6)
    const section1Ids = padStripWithRecommendations ? recent.slice(0, 4) : []
    const fillFromPool: string[] = []
    if (padStripWithRecommendations) {
      for (const l of moreListings) {
        if (recent6.length + fillFromPool.length >= 6) break
        if (l.id === currentListingId) continue
        if (recent6.includes(l.id) || fillFromPool.includes(l.id)) continue
        fillFromPool.push(l.id)
      }
    }
    const section2Ids = padStripWithRecommendations
      ? [...new Set([...recent6, ...fillFromPool])].slice(0, 6)
      : recent6

    const needFetch = [...new Set([...section1Ids, ...section2Ids])].filter((id) => !byId.has(id))

    const applyRows = (
      c1: PdpRecentStripListingWithFavorite[],
      c2: PdpRecentStripListingWithFavorite[],
    ) => {
      const catalog = c1.length ? c1 : null
      const market = c2.length ? c2 : null
      if (!cancelled) {
        setCatalogRow(catalog)
        setMarketRow(market)
        setRecentUi(
          catalog?.length || market?.length ? { phase: "content" } : { phase: "idle" },
        )
      }
    }

    async function run() {
      if (needFetch.length === 0) {
        const resolve = (id: string) => byId.get(id)
        const c1 = section1Ids.map(resolve).filter(Boolean) as PdpRecentStripListingWithFavorite[]
        const c2 = section2Ids.map(resolve).filter(Boolean) as PdpRecentStripListingWithFavorite[]
        applyRows(c1, c2)
        return
      }

      const showCatalogSkeleton =
        padStripWithRecommendations && section1Ids.length > 0
      const marketSkeletonTiles = Math.min(Math.max(section2Ids.length, 2), 6)

      if (!cancelled) {
        setRecentUi({
          phase: "skeleton",
          skeletonCatalog: showCatalogSkeleton,
          skeletonMarketTileCount: marketSkeletonTiles,
          skeletonCatalogTileCount: Math.min(Math.max(section1Ids.length, 2), 4),
        })
      }

      try {
        const res = await fetch(
          `/api/listings/surfboards/by-ids?ids=${encodeURIComponent(needFetch.join(","))}`,
        )
        const json = (await res.json()) as {
          data?: { listings?: PdpRecentStripListingWithFavorite[] }
        }
        const fetched = json.data?.listings ?? []
        for (const row of fetched) {
          byId.set(row.id, row)
        }
      } catch {
        /* ignore */
      }

      if (cancelled) return

      const resolve = (id: string) => byId.get(id)
      const c1 = section1Ids.map(resolve).filter(Boolean) as PdpRecentStripListingWithFavorite[]
      const c2 = section2Ids.map(resolve).filter(Boolean) as PdpRecentStripListingWithFavorite[]

      applyRows(c1, c2)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [currentListingId, moreListings, padStripWithRecommendations])

  if (recentUi.phase === "skeleton") {
    return (
      <div className="min-w-0 w-full space-y-14">
        {recentUi.skeletonCatalog ? (
          <PdpRecentStripSkeleton
            titleSkeletonClass="w-72 max-w-[min(100%,20rem)]"
            tileCount={recentUi.skeletonCatalogTileCount}
          />
        ) : null}
        <PdpRecentStripSkeleton
          titleSkeletonClass={
            padStripWithRecommendations ? "w-80 max-w-[90%]" : "w-56 max-w-[min(100%,18rem)]"
          }
          tileCount={recentUi.skeletonMarketTileCount}
        />
      </div>
    )
  }

  if (recentUi.phase === "idle" || (!catalogRow?.length && !marketRow?.length)) {
    return null
  }

  return (
    <div className="min-w-0 w-full space-y-14">
      {catalogRow?.length ? (
        <section className="min-w-0 w-full border-t border-neutral-200/90 pt-12 dark:border-neutral-700/70">
          <h2 className="mb-8 px-4 text-2xl font-bold text-foreground sm:px-6 lg:px-8">
            Recently viewed products
          </h2>
          <PdpRecentHorizontalStrip tileCount={catalogRow.length}>
            {catalogRow.map((listing) => (
              <PdpRecentCatalogCard
                key={listing.id}
                listing={listing}
                tilesInRow={catalogRow.length}
                sparseRow={catalogRow.length <= 2}
              />
            ))}
          </PdpRecentHorizontalStrip>
        </section>
      ) : null}

      {marketRow?.length ? (
        <section className="min-w-0 w-full border-t border-neutral-200/90 pt-12 dark:border-neutral-700/70">
          <h2 className="mb-8 px-4 text-2xl font-bold text-foreground sm:px-6 lg:px-8">
            {padStripWithRecommendations ? (
              <>Recently Viewed &amp; More</>
            ) : (
              "Recently viewed"
            )}
          </h2>
          <PdpRecentHorizontalStrip tileCount={marketRow.length}>
            {marketRow.map((listing) => (
              <PdpRecentMarketplaceCard
                key={listing.id}
                listing={listing}
                viewerUserId={viewerUserId}
                tilesInRow={marketRow.length}
                sparseRow={marketRow.length <= 2}
              />
            ))}
          </PdpRecentHorizontalStrip>
        </section>
      ) : null}
    </div>
  )
}
