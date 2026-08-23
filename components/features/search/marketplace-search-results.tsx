"use client"

import { useCallback, useMemo, useState } from "react"
import { NaturalLanguageSearchHelper } from "@/components/features/search/natural-language-search-helper"
import {
  RecentFeedClient,
  type RecentListing,
} from "@/components/recent-feed-client"

function mergeMatchedListings(
  initial: RecentListing[],
  listings: RecentListing[],
  rankedIds: string[],
  dropIds: string[],
): RecentListing[] {
  const byId = new Map<string, RecentListing>()
  for (const row of initial) byId.set(row.id, row)
  for (const row of listings) byId.set(row.id, row)

  const drop = new Set(rankedIds.length > 0 ? dropIds : [])
  const seen = new Set<string>()
  const out: RecentListing[] = []

  const push = (id: string) => {
    if (seen.has(id) || drop.has(id)) return
    const row = byId.get(id)
    if (!row) return
    seen.add(id)
    out.push(row)
  }

  for (const id of rankedIds) push(id)
  for (const row of listings) push(row.id)
  for (const row of initial) push(row.id)
  return out
}

export function MarketplaceSearchResults({
  query,
  qualityEventId,
  listings,
  favoritedListingIds,
  isLoggedIn,
  viewerUserId,
  hydrateOwnFavorites,
  emptyMessage,
}: {
  query: string
  qualityEventId: string | null
  listings: RecentListing[]
  favoritedListingIds: string[]
  isLoggedIn: boolean
  viewerUserId: string | null
  hydrateOwnFavorites?: boolean
  emptyMessage?: string
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

  const merged = useMemo(
    () =>
      matched
        ? mergeMatchedListings(listings, matched.listings, matched.rankedIds, matched.dropIds)
        : listings,
    [listings, matched],
  )

  return (
    <>
      {query.trim() ? (
        <div className="mb-4 max-w-2xl">
          <NaturalLanguageSearchHelper
            query={query}
            searchParamsString=""
            qualityEventId={qualityEventId}
            onMatch={onMatch}
          />
        </div>
      ) : null}
      <RecentFeedClient
        listings={merged}
        favoritedListingIds={favoritedListingIds}
        isLoggedIn={isLoggedIn}
        viewerUserId={viewerUserId}
        hydrateOwnFavorites={hydrateOwnFavorites}
        emptyMessage={emptyMessage}
      />
    </>
  )
}
