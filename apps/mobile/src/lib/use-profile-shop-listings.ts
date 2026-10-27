import type { MobileListingCard, MobileProfileShopSection } from "@reswell/api-contract"
import { useCallback, useEffect, useState } from "react"
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
  return {
    ...next,
    listings: [...previous.listings, ...next.listings],
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

  useEffect(() => {
    if (!slug) return
    let cancelled = false
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
    setError(null)
    setLoadingCurrent(true)
    setCurrent(emptyPage())
    fetchProfileListings(slug, { status: "current", section: sectionId ?? undefined })
      .then((page) => {
        if (!cancelled) {
          setCurrent({
            listings: page.listings,
            offset: page.offset,
            limit: page.limit,
            has_more: page.has_more,
          })
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Unable to load listings")
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCurrent(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug, sectionId])

  useEffect(() => {
    if (!slug || !soldRequested) return
    let cancelled = false
    setError(null)
    setLoadingSold(true)
    setSold(emptyPage())
    fetchProfileListings(slug, { status: "sold", section: sectionId ?? undefined })
      .then((page) => {
        if (!cancelled) {
          setSold({
            listings: page.listings,
            offset: page.offset,
            limit: page.limit,
            has_more: page.has_more,
          })
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setSold(emptyPage())
          setError(cause instanceof Error ? cause.message : "Unable to load listings")
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSold(false)
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
      if (!slug || loadingMore) return
      const page = status === "sold" ? sold : current
      if (!page.has_more) return
      setLoadingMore(true)
      fetchProfileListings(slug, {
        status,
        section: sectionId ?? undefined,
        offset: page.offset + page.limit,
      })
        .then((next) => {
          if (status === "sold") {
            setSold((previous) => mergePage(previous, next))
          } else {
            setCurrent((previous) => mergePage(previous, next))
          }
        })
        .catch(() => undefined)
        .finally(() => setLoadingMore(false))
    },
    [slug, current, sold, loadingMore, sectionId],
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
