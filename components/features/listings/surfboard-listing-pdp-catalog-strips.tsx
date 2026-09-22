import type { User } from "@supabase/supabase-js"
import { ListingRelatedContentSection } from "@/components/features/listings/listing-related-content-section"
import { ListingPdpRecentSections } from "@/components/features/listings/listing-pdp-recent-sections"
import { HomePeerListingScrollTile, HomeListingScrollRow, type HomePeerScrollListing } from "@/components/features/home"
import { ListingDetailBottomStripSkeleton } from "@/components/listing-detail-page-loading"
import { fetchSimilarSurfboardsForListingPdp } from "@/lib/db/listing-detail-similar-surfboards"
import {
  HOME_PEER_LISTING_WITH_PROFILE_SELECT,
  hydrateHomePeerListingRows,
} from "@/lib/db/home-peer-listing-feed"
import { fetchSignedInPdpRecentlyViewedSurfboards } from "@/lib/services/pdp-recent-strip-listings"
import { getDb } from "@/lib/supabase/db"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"

const SELLER_BOARDS_PDP_LIMIT = 12

export function SurfboardListingPdpCatalogStripsFallback() {
  return (
    <div aria-hidden>
      <ListingDetailBottomStripSkeleton titleWidthClass="max-w-[min(100%,22rem)] w-72" tileCount={5} />
      <ListingDetailBottomStripSkeleton titleWidthClass="max-w-[min(100%,18rem)] w-56" tileCount={4} />
    </div>
  )
}

export async function SurfboardListingPdpCatalogStrips({
  board,
  viewerUser,
}: {
  board: {
    id: string
    user_id: string
    price: unknown
    board_type?: string | null
  }
  viewerUser?: User | null
}) {
  const { supabase, user: sessionUser } = await getCachedRequestSession()
  const user = viewerUser ?? sessionUser
  const catalog = getDb({ consistency: "eventual" })
  const listPriceNum =
    typeof board.price === "number" ? board.price : Number.parseFloat(String(board.price)) || 0

  let similarBoardsRaw: Awaited<ReturnType<typeof fetchSimilarSurfboardsForListingPdp>> = []
  let sellerBoardsRes: { data: Record<string, unknown>[] | null } = { data: [] }
  let dbRecentListings: Awaited<
    ReturnType<typeof fetchSignedInPdpRecentlyViewedSurfboards>
  > | undefined

  try {
    ;[similarBoardsRaw, sellerBoardsRes, dbRecentListings] = await Promise.all([
      fetchSimilarSurfboardsForListingPdp(catalog, {
        excludeListingId: board.id,
        boardType: board.board_type,
        priceUsd: listPriceNum,
      }),
      catalog
        .from("listings")
        .select(HOME_PEER_LISTING_WITH_PROFILE_SELECT)
        .eq("user_id", board.user_id)
        .eq("status", "active")
        .eq("section", "surfboards")
        .eq("hidden_from_site", false)
        .neq("id", board.id)
        .order("created_at", { ascending: false })
        .limit(SELLER_BOARDS_PDP_LIMIT),
      user
        ? fetchSignedInPdpRecentlyViewedSurfboards(supabase, user.id, board.id)
        : Promise.resolve(undefined),
    ])
  } catch (error) {
    console.error("[surfboard-pdp] catalog strips failed", error)
  }

  const sellerBoards = hydrateHomePeerListingRows((sellerBoardsRes.data ?? []) as Record<string, unknown>[])
  const similarBoards = hydrateHomePeerListingRows(similarBoardsRaw)
  const stripIds = [
    ...sellerBoards.map((item) => item.id),
    ...similarBoards.map((row) => String(row.id)),
  ]

  let favoritedIds = new Set<string>()
  if (user && stripIds.length > 0) {
    try {
      const { data } = await supabase
        .from("favorites")
        .select("listing_id")
        .eq("user_id", user.id)
        .in("listing_id", stripIds)
      favoritedIds = new Set((data ?? []).map((row) => row.listing_id))
    } catch (error) {
      console.error("[surfboard-pdp] strip favorites failed", error)
    }
  }

  return (
    <>
      {similarBoards.length > 0 ? (
        <section className="mt-10 border-t border-neutral-200/90 pt-8 dark:border-neutral-700/70">
          <h2 className="mb-8 text-2xl font-bold text-foreground">Similar boards</h2>
          <HomeListingScrollRow uniformCardHeights>
            {similarBoards.map((row) => (
              <HomePeerListingScrollTile
                key={String(row.id)}
                listing={row as unknown as HomePeerScrollListing}
                userId={user?.id ?? null}
                isFavorited={favoritedIds.has(String(row.id))}
              />
            ))}
          </HomeListingScrollRow>
        </section>
      ) : null}

      <ListingRelatedContentSection listingId={board.id} variant="embedded" />

      {sellerBoards.length > 0 ? (
        <section className="mt-16 min-w-0 w-full border-t border-neutral-200/90 pt-12 dark:border-neutral-700/70">
          <h2 className="mb-8 text-2xl font-bold text-foreground">
            More boards from this seller
          </h2>
          <HomeListingScrollRow uniformCardHeights>
            {sellerBoards.map((item) => (
              <HomePeerListingScrollTile
                key={item.id}
                listing={item}
                userId={user?.id ?? null}
                isFavorited={favoritedIds.has(item.id)}
              />
            ))}
          </HomeListingScrollRow>
        </section>
      ) : null}

      <ListingPdpRecentSections
        key={board.id}
        currentListingId={board.id}
        viewerUserId={user?.id ?? null}
        moreListings={[]}
        padStripWithRecommendations={false}
        initialDbRecentListings={dbRecentListings}
      />
    </>
  )
}
