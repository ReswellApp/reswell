"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Clock, X, TrendingUp } from "lucide-react"
import { createPortal } from "react-dom"
import { SearchInputWithSuggest } from "@/components/search-input-with-suggest"
import { SiteSearchBar, siteSearchInputClassName } from "@/components/site-search-bar"
import { Skeleton } from "@/components/ui/skeleton"
import { clearNavSearchQuery, writeNavSearchQuery } from "@/lib/nav-search-storage"
import { goToCuratedSearchPage } from "@/lib/nav-curated-search"
import { createClient } from "@/lib/supabase/client"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import { listingTitleThumbnailSrc, type ListingImageForCard } from "@/lib/listing-image-display"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { navigateToBrandProfileFromNavPick } from "@/lib/nav-marketplace-brand-search"
import {
  rankNavSuggestedSurfboardRows,
  readNavSuggestedListingEngagement,
  recordNavSuggestedListingEngagement,
} from "@/lib/nav-suggested-listings-storage"

const RECENT_SEARCHES_KEY = "reswell_recent_searches"

function isSearchResultsPath(p: string) {
  return p === "/search" || p === "/search/recent"
}
const MAX_RECENT = 5

type SuggestedListing = {
  id: string
  slug: string | null
  title: string
  price: number
  imageUrl: string | null
}

/** `popular` ranks by `listings.views` and boosts boards opened from this browser via nav suggestions / typeahead. */
export type HeaderNavSuggestedSurfboardsMode = "popular" | "newest"

type SuggestedListingPoolRow = {
  id: string
  slug: string | null
  title: string
  price: number
  views: number | null
  created_at: string
  imageUrl: string | null
}

const SUGGESTED_POOL_SELECT =
  "id, slug, title, price, views, created_at, listing_images (url, thumbnail_url, is_primary)"

function listingRecordToSuggestedPoolRow(l: Record<string, unknown>): SuggestedListingPoolRow {
  const imgs = (l.listing_images as ListingImageForCard[] | null) ?? []
  return {
    id: l.id as string,
    slug: (l.slug as string | null) ?? null,
    title: l.title as string,
    price: Number(l.price),
    views: l.views != null ? Number(l.views) : null,
    created_at: l.created_at as string,
    imageUrl: listingTitleThumbnailSrc(imgs) || null,
  }
}

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]")
  } catch {
    return []
  }
}

function saveRecentSearch(term: string) {
  const recent = getRecentSearches().filter(
    (s) => s.toLowerCase() !== term.toLowerCase(),
  )
  recent.unshift(term)
  localStorage.setItem(
    RECENT_SEARCHES_KEY,
    JSON.stringify(recent.slice(0, MAX_RECENT)),
  )
}

function removeRecentSearch(term: string) {
  const recent = getRecentSearches().filter(
    (s) => s.toLowerCase() !== term.toLowerCase(),
  )
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent))
}

function SuggestedSurfboardsSkeleton() {
  return (
    <div className="py-2" aria-busy="true" aria-label="Loading suggested surfboards">
      <div className="flex items-center gap-2 px-4 pb-2">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-3 w-36" />
      </div>
      <ul className="space-y-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li key={i} className="mx-1 flex gap-3 rounded-xl px-3 py-2.5">
            <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2 pt-0.5">
              <Skeleton className="h-4 w-full max-w-[240px]" />
              <Skeleton className="h-4 w-16" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function HeaderNavSearch({
  suggestedSurfboardsMode = "popular",
}: {
  suggestedSurfboardsMode?: HeaderNavSuggestedSurfboardsMode
} = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState("")
  const prevPathnameRef = useRef(pathname)

  const [idleOpen, setIdleOpen] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [suggestedPool, setSuggestedPool] = useState<SuggestedListingPoolRow[]>([])
  const [suggestedLoaded, setSuggestedLoaded] = useState(false)
  const [suggestedRankTick, setSuggestedRankTick] = useState(0)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const idleDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isSearchResultsPath(pathname)) return
    const qFromUrl = searchParams.get("q")?.trim() ?? ""
    if (qFromUrl) {
      setQuery(qFromUrl)
      writeNavSearchQuery(qFromUrl)
    }
  }, [pathname, searchParams])

  useEffect(() => {
    const prev = prevPathnameRef.current
    prevPathnameRef.current = pathname
    if (isSearchResultsPath(prev) && !isSearchResultsPath(pathname)) {
      setQuery("")
      clearNavSearchQuery()
    }
  }, [pathname])

  useEffect(() => {
    setSuggestedLoaded(false)
    setSuggestedPool([])
  }, [suggestedSurfboardsMode])

  const suggestedListings = useMemo((): SuggestedListing[] => {
    if (!suggestedPool.length) return []
    const rows =
      suggestedSurfboardsMode === "popular"
        ? rankNavSuggestedSurfboardRows(
            suggestedPool,
            readNavSuggestedListingEngagement(),
            3,
          )
        : suggestedPool.slice(0, 3)
    return rows.map(({ id, slug, title, price, imageUrl }) => ({
      id,
      slug,
      title,
      price,
      imageUrl,
    }))
    // suggestedRankTick re-reads engagement from localStorage
  }, [suggestedPool, suggestedSurfboardsMode, suggestedRankTick])

  const fetchSuggested = useCallback(async () => {
    if (suggestedLoaded) return
    try {
      const supabase = createClient()
      const poolLimit = suggestedSurfboardsMode === "popular" ? 24 : 3

      const engagedIdsSorted =
        suggestedSurfboardsMode === "popular"
          ? Object.entries(readNavSuggestedListingEngagement())
              .filter(([, n]) => n > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([id]) => id)
              .slice(0, 12)
          : []

      let q = supabase
        .from("listings")
        .select(SUGGESTED_POOL_SELECT)
        .eq("status", "active")
        .eq("section", "surfboards")
        .eq("hidden_from_site", false)
      if (suggestedSurfboardsMode === "popular") {
        q = q
          .order("views", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
      } else {
        q = q.order("created_at", { ascending: false })
      }
      const { data } = await q.limit(poolLimit)
      let merged: SuggestedListingPoolRow[] = (data ?? []).map((l) =>
        listingRecordToSuggestedPoolRow(l as Record<string, unknown>),
      )

      if (suggestedSurfboardsMode === "popular" && engagedIdsSorted.length > 0) {
        const poolIds = new Set(merged.map((r) => r.id))
        const missingEngaged = engagedIdsSorted.filter((id) => !poolIds.has(id))
        if (missingEngaged.length > 0) {
          const { data: extra } = await supabase
            .from("listings")
            .select(SUGGESTED_POOL_SELECT)
            .in("id", missingEngaged)
            .eq("status", "active")
            .eq("section", "surfboards")
            .eq("hidden_from_site", false)
          if (extra?.length) {
            for (const raw of extra) {
              const row = listingRecordToSuggestedPoolRow(raw as Record<string, unknown>)
              if (!poolIds.has(row.id)) {
                poolIds.add(row.id)
                merged.push(row)
              }
            }
          }
        }
      }

      setSuggestedPool(merged)
      setSuggestedLoaded(true)
    } catch {
      setSuggestedLoaded(true)
    }
  }, [suggestedLoaded, suggestedSurfboardsMode])

  const mergeFetchedListingIntoSuggestedPool = useCallback(async (listingId: string) => {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from("listings")
        .select(SUGGESTED_POOL_SELECT)
        .eq("id", listingId)
        .eq("status", "active")
        .eq("section", "surfboards")
        .eq("hidden_from_site", false)
        .maybeSingle()
      if (!data) return
      setSuggestedPool((prev) => {
        if (prev.some((r) => r.id === listingId)) return prev
        return [...prev, listingRecordToSuggestedPoolRow(data as Record<string, unknown>)]
      })
    } catch {
      /* ignore */
    }
  }, [])

  const bumpNavSuggestedListingEngagement = useCallback(
    (listingId: string) => {
      recordNavSuggestedListingEngagement(listingId)
      if (suggestedSurfboardsMode === "popular") {
        void mergeFetchedListingIntoSuggestedPool(listingId)
      }
      setSuggestedRankTick((t) => t + 1)
    },
    [mergeFetchedListingIntoSuggestedPool, suggestedSurfboardsMode],
  )

  const handleIdleFocus = useCallback(() => {
    if (query.trim().length > 0) return
    const recent = getRecentSearches()
    setRecentSearches(recent)
    if (recent.length === 0) fetchSuggested()
    setIdleOpen(true)
  }, [query, fetchSuggested])

  useEffect(() => {
    if (!idleOpen || !formRef.current) {
      setDropdownRect(null)
      return
    }
    const el = formRef.current
    const update = () => {
      const rect = el.getBoundingClientRect()
      setDropdownRect({ top: rect.bottom + 6, left: rect.left, width: rect.width })
    }
    update()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [idleOpen])

  useEffect(() => {
    if (!idleOpen) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (formRef.current?.contains(target)) return
      if (idleDropdownRef.current?.contains(target)) return
      setIdleOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [idleOpen])

  useEffect(() => {
    if (query.trim().length > 0) setIdleOpen(false)
  }, [query])

  const runSearch = useCallback(
    (q: string) => {
      const term = q.trim()
      if (!term) return
      saveRecentSearch(term)
      const category = isSearchResultsPath(pathname)
        ? searchParams.get("category")
        : null
      const params = new URLSearchParams()
      params.set("q", term)
      if (category?.trim()) params.set("category", category.trim())
      params.set("nq", "1")
      setQuery(term)
      writeNavSearchQuery(term)
      router.push(`/search?${params.toString()}`)
      setIdleOpen(false)
    },
    [router, pathname, searchParams],
  )

  const clearSearchAndStorage = useCallback(() => {
    setQuery("")
    clearNavSearchQuery()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const term = query.trim()
    if (!term) {
      clearNavSearchQuery()
      setQuery("")
      await goToCuratedSearchPage(router, pathname, searchParams.toString())
      return
    }
    runSearch(query)
  }

  const handleRemoveRecent = (term: string) => {
    removeRecentSearch(term)
    const updated = getRecentSearches()
    setRecentSearches(updated)
    if (updated.length === 0) fetchSuggested()
  }

  const showIdleDropdown = idleOpen && query.trim().length === 0

  const panelWidth = dropdownRect ? dropdownRect.width : 400
  const panelLeft = dropdownRect ? dropdownRect.left : 0

  const idleDropdown =
    showIdleDropdown &&
    dropdownRect &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={idleDropdownRef}
        className="fixed z-[100] overflow-hidden rounded-2xl border border-border/80 bg-popover text-popover-foreground shadow-xl shadow-black/10"
        style={{
          top: dropdownRect.top,
          left: panelLeft,
          width: panelWidth,
        }}
      >
        {recentSearches.length > 0 ? (
          <div className="py-2">
            <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent searches
            </p>
            <ul>
              {recentSearches.map((term) => (
                <li key={term} className="group flex items-center">
                  <button
                    type="button"
                    className="flex flex-1 items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => runSearch(term)}
                  >
                    <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {term}
                  </button>
                  <button
                    type="button"
                    className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                    aria-label={`Remove "${term}"`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleRemoveRecent(term)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : !suggestedLoaded ? (
          <SuggestedSurfboardsSkeleton />
        ) : suggestedListings.length > 0 ? (
          <div className="py-2">
            <div className="flex items-center gap-2 px-4 pb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Suggested surfboards
              </p>
            </div>
            <ul>
              {suggestedListings.map((listing) => (
                <li key={listing.id}>
                  <Link
                    href={listingDetailHref({
                      id: listing.id,
                      slug: listing.slug,
                      section: "surfboards",
                    })}
                    className="mx-1 flex gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/60"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      bumpNavSuggestedListingEngagement(listing.id)
                      setIdleOpen(false)
                    }}
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {listing.imageUrl ? (
                        <Image
                          src={listing.imageUrl}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="56px"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                          No photo
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-semibold text-foreground">
                        {capitalizeWords(listing.title)}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-black dark:text-white">
                        ${listing.price.toFixed(2)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>,
      document.body,
    )

  return (
    <div className="hidden min-w-0 w-full flex-1 items-center px-2 md:flex">
      <SiteSearchBar ref={formRef} onSubmit={handleSubmit} className="w-full">
        <SearchInputWithSuggest
          value={query}
          onChange={setQuery}
          onBrandStripPick={(brandName, resolved) => {
            saveRecentSearch(brandName)
            const category = isSearchResultsPath(pathname)
              ? searchParams.get("category")
              : null
            if (resolved?.catalogSlug) {
              router.push(`${BRANDS_BASE}/${encodeURIComponent(resolved.catalogSlug)}`)
            } else {
              void navigateToBrandProfileFromNavPick(router, brandName, {
                categorySlug: category,
                navSubmitted: true,
              })
            }
            setQuery("")
            clearNavSearchQuery()
            setIdleOpen(false)
          }}
          onSelect={(text) => {
            saveRecentSearch(text)
            runSearch(text)
          }}
          onNavigate={clearSearchAndStorage}
          onFocus={handleIdleFocus}
          placeholder="Search surfboards…"
          section=""
          listboxId="header-nav-search-suggestions"
          inputClassName={siteSearchInputClassName()}
          className="w-full"
          minLength={2}
          analyticsSurface="header_nav"
          onMarketplaceTopListingNavigate={bumpNavSuggestedListingEngagement}
          showTextSuggestions={false}
          matchAnchorWidth
        />
      </SiteSearchBar>
      {idleDropdown}
    </div>
  )
}
