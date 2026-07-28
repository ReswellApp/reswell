"use client"

import { useLayoutEffect, useState } from "react"
import { ListingTileSkeleton } from "@/components/listing-tile-skeleton"
import {
  HomeListingScrollRow,
  HomePeerListingScrollTile,
  type HomePeerScrollListing,
} from "@/components/features/home"
import type { PdpRecentStripListingWithFavorite } from "@/lib/pdp-recent-strip-listing"
import {
  pushRecentSurfboardListingId,
  readRecentSurfboardListingIds,
} from "@/lib/utils/recent-viewed-surfboards-storage"
import { Skeleton } from "@/components/ui/skeleton"
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

function PdpRecentHomePeerTile({
  listing,
  viewerUserId,
}: {
  listing: PdpRecentStripListingWithFavorite
  viewerUserId: string | null
}) {
  return (
    <HomePeerListingScrollTile
      listing={pdpRecentToHomePeerListing(listing)}
      userId={viewerUserId}
      isFavorited={listing.viewerFavorited}
      layout="homeScroll"
    />
  )
}

function PdpRecentStripSkeleton({
  titleSkeletonClass: titleClass,
  tileCount,
}: {
  titleSkeletonClass: string
  tileCount: number
}) {
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
      <HomeListingScrollRow uniformCardHeights>
        {Array.from({ length: tileCount }, (_, i) => (
          <ListingTileSkeleton key={i} layout="homeScroll" index={i} />
        ))}
      </HomeListingScrollRow>
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
          <HomeListingScrollRow uniformCardHeights>
            {catalogRow.map((listing) => (
              <PdpRecentHomePeerTile
                key={listing.id}
                listing={listing}
                viewerUserId={viewerUserId}
              />
            ))}
          </HomeListingScrollRow>
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
          <HomeListingScrollRow uniformCardHeights>
            {marketRow.map((listing) => (
              <PdpRecentHomePeerTile
                key={listing.id}
                listing={listing}
                viewerUserId={viewerUserId}
              />
            ))}
          </HomeListingScrollRow>
        </section>
      ) : null}
    </div>
  )
}
