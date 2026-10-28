import type { MobileListingCard, MobileProfileShopSection } from "@reswell/api-contract"
import { useCallback, useEffect, useRef, useState } from "react"
import { fetchProfileListings, fetchProfileShopFilters } from "@/lib/api"

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

function mergePage(previous: InventoryPage, next: InventoryPage): InventoryPage {
  const seen = new Set(previous.listings.map((listing) => listing.id))
  return {
    ...next,
    listings: [...previous.listings, ...next.listings.filter((listing) => !seen.has(listing.id))],
  }
}

export function useProfileShopListings(slug: string | undefined, shopTab: "listings" | "sold") {
  const activeStatus: ShopTab = shopTab === "sold" ? "sold" : "current"
  const [current, setCurrent] = useState<InventoryPage>(emptyPage)
  const [sold, setSold] = useState<InventoryPage>(emptyPage)
  const [soldRequested, setSoldRequested] = useState(false)
  const [currentSections, setCurrentSections] = useState<MobileProfileShopSection[]>([])
  const [soldSections, setSoldSections] = useState<MobileProfileShopSection[]>([])
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [loadingCurrent, setLoadingCurrent] = useState(true)
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
    setCurrent(emptyPage())
    setSold(emptyPage())
    setSoldRequested(false)
    setCurrentSections([])
    setSoldSections([])
    setError(null)

    Promise.all([fetchProfileShopFilters(slug, "current"), fetchProfileShopFilters(slug, "sold")])
      .then(([currentFilters, soldFilters]) => {
        if (cancelled) return
        setCurrentSections(currentFilters.sections)
        setSoldSections(soldFilters.sections)
      })
      .catch(() => {
        if (!cancelled) {
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
    setLoadingCurrent(true)
    setCurrent(emptyPage())
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
        if (!cancelled && currentGeneration.current === generation) {
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
    setLoadingSold(true)
    setSold(emptyPage())
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
        if (!cancelled && soldGeneration.current === generation) {
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
