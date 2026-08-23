"use client"

import { useCallback, useMemo, useState } from "react"
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import { NaturalLanguageSearchHelper } from "@/components/features/search/natural-language-search-helper"
import type { RecentListing } from "@/components/recent-feed-client"
import type { BoardBrowseListingRow } from "@/lib/db/boards-browse-listings"
import type { ListingImageForCard } from "@/lib/listing-image-display"

function recentToBoardRow(listing: RecentListing): BoardBrowseListingRow {
  return {
    id: listing.id,
    slug: listing.slug,
    user_id: listing.user_id,
    title: listing.title,
    price: listing.price,
    status: listing.status ?? "active",
    local_pickup: listing.local_pickup,
    shipping_available: listing.shipping_available,
    listing_images: (listing.listing_images ?? null) as ListingImageForCard[] | null,
    categories: listing.categories,
    board_type: listing.board_type,
    condition: listing.condition,
  }
}

function mergeBoardRows(
  initial: BoardBrowseListingRow[],
  listings: RecentListing[],
  rankedIds: string[],
  dropIds: string[],
): BoardBrowseListingRow[] {
  const byId = new Map<string, BoardBrowseListingRow>()
  for (const row of initial) byId.set(row.id, row)
  for (const listing of listings) byId.set(listing.id, recentToBoardRow(listing))

  const drop = new Set(rankedIds.length > 0 ? dropIds : [])
  const seen = new Set<string>()
  const out: BoardBrowseListingRow[] = []
  const push = (id: string) => {
    if (seen.has(id) || drop.has(id)) return
    const row = byId.get(id)
    if (!row) return
    seen.add(id)
    out.push(row)
  }
  for (const id of rankedIds) push(id)
  for (const listing of listings) push(listing.id)
  for (const row of initial) push(row.id)
  return out
}

export function BoardsKeywordResults({
  query,
  searchParamsString,
  qualityEventId,
  initialAppliedLabels,
  initialSummary,
  boardRows,
  favoritedIds,
  userId,
}: {
  query: string
  searchParamsString: string
  qualityEventId: string | null
  initialAppliedLabels?: string[]
  initialSummary?: string | null
  boardRows: BoardBrowseListingRow[]
  favoritedIds: string[]
  userId: string | null
}) {
  const [matched, setMatched] = useState<{
    listings: RecentListing[]
    rankedIds: string[]
    dropIds: string[]
  } | null>(null)

  const onMatch = useCallback(
    (payload: { listings: RecentListing[]; rankedIds: string[]; dropIds: string[] }) => {
      setMatched(payload)
    },
    [],
  )

  const rows = useMemo(
    () =>
      matched
        ? mergeBoardRows(boardRows, matched.listings, matched.rankedIds, matched.dropIds)
        : boardRows,
    [boardRows, matched],
  )

  return (
    <>
      <div className="mb-4">
        <NaturalLanguageSearchHelper
          query={query}
          searchParamsString={searchParamsString}
          initialAppliedLabels={initialAppliedLabels}
          initialSummary={initialSummary}
          qualityEventId={qualityEventId}
          onMatch={onMatch}
        />
      </div>
      {rows.length === 0 ? null : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rows.map((board, tileIdx) => (
            <HomePeerListingScrollTile
              key={board.id}
              layout="grid"
              userId={userId}
              isFavorited={favoritedIds.includes(board.id)}
              imagePriority={tileIdx < 2}
              listing={{
                id: board.id,
                slug: board.slug,
                user_id: board.user_id,
                title: board.title,
                price: board.price,
                status: board.status,
                section: "surfboards",
                local_pickup: board.local_pickup,
                shipping_available: board.shipping_available,
                listing_images: board.listing_images,
                categories: board.categories,
                board_type: board.board_type,
                condition: board.condition,
              }}
            />
          ))}
        </div>
      )}
    </>
  )
}
