"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { RecentFeedClient, type RecentListing } from "@/components/recent-feed-client"
import { CITY_LANDING_PAGE_SIZE } from "@/lib/city-landing-path"

type CityLandingListingsProps = {
  listings: RecentListing[]
  emptyMessage: string
}

export function CityLandingListings({ listings, emptyMessage }: CityLandingListingsProps) {
  const [visibleCount, setVisibleCount] = useState(
    Math.min(CITY_LANDING_PAGE_SIZE, listings.length),
  )
  const sentinelRef = useRef<HTMLDivElement>(null)
  const visibleListings = listings.slice(0, visibleCount)
  const hasMore = visibleCount < listings.length

  const loadMore = useCallback(() => {
    setVisibleCount((current) => Math.min(current + CITY_LANDING_PAGE_SIZE, listings.length))
  }, [listings.length])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) loadMore()
      },
      { rootMargin: "800px 0px" },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadMore, visibleCount])

  return (
    <>
      <RecentFeedClient
        listings={visibleListings}
        favoritedListingIds={[]}
        isLoggedIn={false}
        viewerUserId={null}
        hydrateOwnFavorites
        emptyMessage={emptyMessage}
      />
      {hasMore ? (
        <div ref={sentinelRef} className="h-px" aria-hidden />
      ) : null}
    </>
  )
}
