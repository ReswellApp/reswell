"use client"

import type { ReactNode } from "react"
import { useLayoutEffect, useState } from "react"
import { listingDetailHorizontalStripBleedClassName } from "@/components/features/home/home-listing-scroll-row"
import {
  HomePeerListingScrollTile,
  type HomePeerScrollListing,
} from "@/components/features/home/home-peer-listing-scroll-tile"
import type { PdpRecentStripListingWithFavorite } from "@/lib/pdp-recent-strip-listing"
import {
  pushRecentSurfboardListingId,
  readRecentSurfboardListingIds,
} from "@/lib/utils/recent-viewed-surfboards-storage"
import { Skeleton } from "@/components/ui/skeleton"
import { listingProductCardClassName } from "@/lib/listing-card-styles"
import { homeUniformScrollBodyClass } from "@/lib/home-listing-scroll-styles"
import { cn } from "@/lib/utils"

function pdpRecentToHomePeerListing(
  listing: PdpRecentStripListingWithFavorite,
): HomePeerScrollListing {
  return {
    id: listing.id,
    slug: listing.slug,
    user_id: listing.user_id,
    title: listing.title,
    price: listing.price,
    status: "active",
    section: listing.section,
    local_pickup: listing.local_pickup,
    shipping_available: listing.shipping_available,
    listing_images: listing.listing_images,
    categories: listing.categories,
    board_type: listing.board_type,
    condition: listing.condition,
  }
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

function pdpRecentStripTileWrapClass(tilesInRow: number, sparseRow: boolean) {
  return cn(
    "flex min-h-0 flex-col",
    recentStripCardMaxWidthClass(),
    tilesInRow === 1 && "mx-auto w-full",
    sparseRow && tilesInRow >= 2 && "w-full flex-1 basis-0 sm:w-auto",
    !sparseRow &&
      "w-[min(100%,260px)] shrink-0 snap-start sm:w-auto sm:min-w-0 sm:flex-1 sm:basis-0 sm:snap-none",
  )
}

function PdpRecentHorizontalStrip({ tileCount, children }: { tileCount: number; children: ReactNode }) {
  const sparse = tileCount <= 2
  return (
    <div className={listingDetailHorizontalStripBleedClassName}>
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

function PdpRecentHomePeerTile({
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
  return (
    <div className={pdpRecentStripTileWrapClass(tilesInRow, sparseRow)}>
      <HomePeerListingScrollTile
        listing={pdpRecentToHomePeerListing(listing)}
        userId={viewerUserId}
        isFavorited={listing.viewerFavorited}
        layout="homeScroll"
        imageSizesOverride={recentStripImageSizes(tilesInRow)}
      />
    </div>
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
      <div className="mb-8">
        <Skeleton className={cn("h-9", titleClass)} />
      </div>
      <div className={listingDetailHorizontalStripBleedClassName}>
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
              className={pdpRecentStripTileWrapClass(tileCount, tileCount <= 2)}
            >
              <div className={cn(listingProductCardClassName, "flex min-h-0 min-w-0 flex-1 flex-col")}>
                <Skeleton className="aspect-[3/4] w-full min-h-[112px] shrink-0 rounded-none sm:min-h-[128px]" />
                <div className={cn(homeUniformScrollBodyClass, "gap-1.5")}>
                  <Skeleton className="h-4 w-full max-w-[min(100%,14rem)]" />
                  <Skeleton className="h-3 w-24" />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
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
   * are shown — no filler tiles from `moreListings`.
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
          <h2 className="mb-8 text-2xl font-bold text-foreground">
            Recently viewed products
          </h2>
          <PdpRecentHorizontalStrip tileCount={catalogRow.length}>
            {catalogRow.map((listing) => (
              <PdpRecentHomePeerTile
                key={listing.id}
                listing={listing}
                viewerUserId={viewerUserId}
                tilesInRow={catalogRow.length}
                sparseRow={catalogRow.length <= 2}
              />
            ))}
          </PdpRecentHorizontalStrip>
        </section>
      ) : null}

      {marketRow?.length ? (
        <section className="min-w-0 w-full border-t border-neutral-200/90 pt-12 dark:border-neutral-700/70">
          <h2 className="mb-8 text-2xl font-bold text-foreground">
            {padStripWithRecommendations ? (
              <>Recently Viewed &amp; More</>
            ) : (
              "Recently viewed"
            )}
          </h2>
          <PdpRecentHorizontalStrip tileCount={marketRow.length}>
            {marketRow.map((listing) => (
              <PdpRecentHomePeerTile
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
