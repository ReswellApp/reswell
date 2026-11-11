import type { MobileListingCard, MobileProfileShopSection } from "@reswell/api-contract"
import { useCallback, useEffect, useRef, useState } from "react"
import { fetchProfileListings, fetchProfileShopFilters } from "@/lib/api"
import { peekProfileListings, peekProfileShopFilters } from "@/lib/marketplace-screen-cache"

type InventoryPage = {
  listings: MobileListingCard[]
  offset: number
  limit: number
  has_more: boolean
}

type ShopTab = "current" | "sold"

function emptyPage(): InventoryPage {
  return { listings: [], offset: 0, limit: 20, has_more: false }
}

function fromListingsPage(page: { listings: MobileListingCard[]; offset: number; limit: number; has_more: boolean }): InventoryPage {
  return {
    listings: page.listings,
    offset: page.offset,
    limit: page.limit,
    has_more: page.has_more,
  }
}

function mergePage(previous: InventoryPage, next: InventoryPage): InventoryPage {
  const seen = new Set(previous.listings.map((listing) => listing.id))
  return {
    ...next,
    listings: [...previous.listings, ...next.listings.filter((listing) => !seen.has(listing.id))],
  }
}

export function useProfileShopListings(slug: string | undefined, shopTab: "listings" | "sold") {
  const activeStatus: ShopTab = shopTab === "sold" ? "sold" : "current"
  const cachedCurrent = slug ? peekProfileListings(slug, "current") : null
  const cachedSold = slug ? peekProfileListings(slug, "sold") : null
  const cachedCurrentFilters = slug ? peekProfileShopFilters(slug, "current") : null
  const cachedSoldFilters = slug ? peekProfileShopFilters(slug, "sold") : null
  const [current, setCurrent] = useState<InventoryPage>(cachedCurrent ? fromListingsPage(cachedCurrent) : emptyPage)
  const [sold, setSold] = useState<InventoryPage>(cachedSold ? fromListingsPage(cachedSold) : emptyPage)
  const [soldRequested, setSoldRequested] = useState(Boolean(cachedSold))
  const [currentSections, setCurrentSections] = useState<MobileProfileShopSection[]>(
    cachedCurrentFilters?.sections ?? [],
  )
  const [soldSections, setSoldSections] = useState<MobileProfileShopSection[]>(cachedSoldFilters?.sections ?? [])
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [loadingCurrent, setLoadingCurrent] = useState(!cachedCurrent)
  const [loadingSold, setLoadingSold] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentRef = useRef(current)
  const soldRef = useRef(sold)
  const loadingMoreRef = useRef(false)
  const currentGeneration = useRef(0)
  const soldGeneration = useRef(0)
  currentRef.current = current
  soldRef.current = sold

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    currentGeneration.current += 1
    soldGeneration.current += 1
    loadingMoreRef.current = false
    setLoadingMore(false)
    setSectionId(null)
    const nextCurrent = peekProfileListings(slug, "current")
    const nextSold = peekProfileListings(slug, "sold")
    const nextCurrentFilters = peekProfileShopFilters(slug, "current")
    const nextSoldFilters = peekProfileShopFilters(slug, "sold")
    setCurrent(nextCurrent ? fromListingsPage(nextCurrent) : emptyPage())
    setSold(nextSold ? fromListingsPage(nextSold) : emptyPage())
    setSoldRequested(Boolean(nextSold))
    setCurrentSections(nextCurrentFilters?.sections ?? [])
    setSoldSections(nextSoldFilters?.sections ?? [])
    setError(null)

    Promise.all([fetchProfileShopFilters(slug, "current"), fetchProfileShopFilters(slug, "sold")])
      .then(([currentFilters, soldFilters]) => {
        if (cancelled) return
        setCurrentSections(currentFilters.sections)
        setSoldSections(soldFilters.sections)
      })
      .catch(() => {
        if (!cancelled && !peekProfileShopFilters(slug, "current")) {
          setCurrentSections([])
          setSoldSections([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    const generation = ++currentGeneration.current
    loadingMoreRef.current = false
    setLoadingMore(false)
    setError(null)
    const cached = peekProfileListings(slug, "current", sectionId)
    if (cached) {
      setCurrent(fromListingsPage(cached))
      setLoadingCurrent(false)
    } else {
      setLoadingCurrent(true)
      if (sectionId) setCurrent(emptyPage())
    }
    fetchProfileListings(slug, { status: "current", section: sectionId ?? undefined })
      .then((page) => {
        if (cancelled || currentGeneration.current !== generation) return
        setCurrent({
          listings: page.listings,
          offset: page.offset,
          limit: page.limit,
          has_more: page.has_more,
        })
      })
      .catch((cause: unknown) => {
        if (!cancelled && currentGeneration.current === generation && !peekProfileListings(slug, "current", sectionId)) {
          setError(cause instanceof Error ? cause.message : "Unable to load listings")
        }
      })
      .finally(() => {
        if (!cancelled && currentGeneration.current === generation) setLoadingCurrent(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug, sectionId])

  useEffect(() => {
    if (!slug || !soldRequested) return
    let cancelled = false
    const generation = ++soldGeneration.current
    loadingMoreRef.current = false
    setLoadingMore(false)
    setError(null)
    const cached = peekProfileListings(slug, "sold", sectionId)
    if (cached) {
      setSold(fromListingsPage(cached))
      setLoadingSold(false)
    } else {
      setLoadingSold(true)
      if (sectionId) setSold(emptyPage())
    }
    fetchProfileListings(slug, { status: "sold", section: sectionId ?? undefined })
      .then((page) => {
        if (cancelled || soldGeneration.current !== generation) return
        setSold({
          listings: page.listings,
          offset: page.offset,
          limit: page.limit,
          has_more: page.has_more,
        })
      })
      .catch((cause: unknown) => {
        if (!cancelled && soldGeneration.current === generation && !peekProfileListings(slug, "sold", sectionId)) {
          setSold(emptyPage())
          setError(cause instanceof Error ? cause.message : "Unable to load listings")
        }
      })
      .finally(() => {
        if (!cancelled && soldGeneration.current === generation) setLoadingSold(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug, sectionId, soldRequested])

  const loadSold = useCallback(() => {
    setSoldRequested(true)
  }, [])

  const loadMore = useCallback(
    (status: ShopTab) => {
      if (!slug || loadingMoreRef.current) return
      const page = status === "sold" ? soldRef.current : currentRef.current
      if (!page.has_more) return
      const generation = status === "sold" ? soldGeneration.current : currentGeneration.current
      loadingMoreRef.current = true
      setLoadingMore(true)
      fetchProfileListings(slug, {
        status,
        section: sectionId ?? undefined,
        offset: page.offset + page.limit,
      })
        .then((next) => {
          const active = status === "sold" ? soldGeneration.current : currentGeneration.current
          if (active !== generation) return
          if (status === "sold") {
            setSold((previous) => mergePage(previous, next))
          } else {
            setCurrent((previous) => mergePage(previous, next))
          }
        })
        .catch(() => undefined)
        .finally(() => {
          const active = status === "sold" ? soldGeneration.current : currentGeneration.current
          if (active !== generation) return
          loadingMoreRef.current = false
          setLoadingMore(false)
        })
    },
    [slug, sectionId],
  )

  const sectionOptions = activeStatus === "sold" ? soldSections : currentSections

  return {
    currentListings: current.listings,
    soldListings: soldRequested ? sold.listings : null,
    hasMoreCurrent: current.has_more,
    hasMoreSold: sold.has_more,
    loadingCurrent,
    loadingSold,
    loadingMore,
    error,
    sectionId,
    setSectionId,
    sectionOptions,
    loadSold,
    loadMore,
  }
}
