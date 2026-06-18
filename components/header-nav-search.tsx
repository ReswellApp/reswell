"use client"

import { useRouter, usePathname } from "next/navigation"
import { useClientSearchParams } from "@/hooks/use-client-search-params"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { X, Search } from "lucide-react"
import { createPortal } from "react-dom"
import {
  getNavSearchPersonalizationAction,
  recordNavRecentlyViewedBrandAction,
  recordNavSearchPersonalizationQueryAction,
  removeNavSearchPersonalizationQueryAction,
} from "@/app/actions/navSearchPersonalization"
import {
  NavSearchTopListingSectionHeader,
  NavSearchTopListingText,
  NavSearchTopListingThumb,
  navSearchTopListingRowClassName,
  navSearchTopListingThumbClassName,
} from "@/components/features/search/nav-search-top-listing-row"
import { SearchInputWithSuggest } from "@/components/search-input-with-suggest"
import {
  SiteSearchBar,
  SITE_SEARCH_SHELL_CLASS,
  siteSearchInputClassName,
} from "@/components/site-search-bar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { clearNavSearchQuery, writeNavSearchQuery } from "@/lib/nav-search-storage"
import { goToCuratedSearchPage } from "@/lib/nav-curated-search"
import type {
  NavSearchPersonalizationBrand,
  NavSearchPersonalizationListing,
} from "@/lib/types/nav-search-personalization"
import type { NavSuggestedSurfboardPoolRow } from "@/lib/types/nav-suggested-surfboards"
import {
  pushRecentNavBrand,
  readRecentNavBrands,
  type RecentNavBrandEntry,
} from "@/lib/utils/recent-nav-brands-storage"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
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

function NavSearchIdleSectionTitle({ title }: { title: string }) {
  return (
    <h3 className="px-4 pt-3 pb-2 text-sm font-bold tracking-tight text-foreground">
      {title}
    </h3>
  )
}

function localRecentBrandsToDisplay(
  entries: RecentNavBrandEntry[],
): NavSearchPersonalizationBrand[] {
  return entries
    .filter((entry) => entry.slug?.trim())
    .map((entry, index) => ({
      id: entry.slug ?? `local-${index}`,
      slug: entry.slug!.trim(),
      name: entry.name,
      logoUrl: entry.logoUrl,
    }))
}

function NavSearchIdleRecentlyViewedBrandTile({
  brand,
  onNavigate,
}: {
  brand: NavSearchPersonalizationBrand
  onNavigate: () => void
}) {
  if (!brand.slug.trim()) return null

  return (
    <Link
      href={`${BRANDS_BASE}/${encodeURIComponent(brand.slug)}`}
      className="w-12 shrink-0 snap-start sm:w-14"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onNavigate}
    >
      <div className={navSearchTopListingThumbClassName}>
        {brand.logoUrl ? (
          <Image
            src={brand.logoUrl}
            alt=""
            fill
            className="object-contain p-1"
            sizes="(max-width:640px) 48px, 56px"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-cerulean">
            {brand.name.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-snug text-foreground sm:text-xs">
        {brand.name}
      </p>
    </Link>
  )
}

function NavSearchIdleRecentlyViewedTile({
  listing,
  onNavigate,
}: {
  listing: NavSearchPersonalizationListing
  onNavigate: () => void
}) {
  return (
    <Link
      href={listingDetailHref({
        id: listing.id,
        slug: listing.slug,
        section: "surfboards",
      })}
      className="w-12 shrink-0 snap-start sm:w-14"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onNavigate}
    >
      <NavSearchTopListingThumb imageUrl={listing.imageUrl} />
      <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-snug text-foreground sm:text-xs">
        {capitalizeWords(listing.title)}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold text-primary sm:text-xs">
        ${listing.price.toFixed(2)}
      </p>
    </Link>
  )
}

function NavSearchPersonalizationSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading search personalization">
      <NavSearchIdleSectionTitle title="Recent searches" />
      <ul className="px-4 pb-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-3 py-3">
            <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-full max-w-[12rem]" />
          </li>
        ))}
      </ul>
      <div className="border-t border-border/60">
        <NavSearchIdleSectionTitle title="Recently viewed listings" />
        <div className="flex gap-3 overflow-hidden px-4 pb-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-12 shrink-0 sm:w-14">
              <Skeleton className="aspect-square w-full rounded-md sm:rounded-lg" />
              <Skeleton className="mt-1.5 h-3 w-full" />
              <Skeleton className="mt-1 h-3 w-8" />
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-border/60">
        <NavSearchIdleSectionTitle title="Recently viewed brands" />
        <div className="flex gap-3 overflow-hidden px-4 pb-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-12 shrink-0 sm:w-14">
              <Skeleton className="aspect-square w-full rounded-md sm:rounded-lg" />
              <Skeleton className="mt-1.5 h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SuggestedSurfboardsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading suggested surfboards">
      <NavSearchTopListingSectionHeader title="Suggested surfboards" />
      <ul className="py-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li key={i} className={navSearchTopListingRowClassName}>
            <Skeleton className="h-12 w-12 shrink-0 rounded-md sm:h-14 sm:w-14 sm:rounded-lg" />
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

/**
 * `desktop` — standard `SiteSearchBar` (pill + "Search" text button) shown on `md+` widths.
 * `mobile` — compact white pill + circular search icon button; parent controls visibility (e.g. mobile header row).
 */
export type HeaderNavSearchVariant = "desktop" | "mobile"

export function HeaderNavSearch({
  suggestedSurfboardsMode = "popular",
  variant = "desktop",
  userId = null,
}: {
  suggestedSurfboardsMode?: HeaderNavSuggestedSurfboardsMode
  variant?: HeaderNavSearchVariant
  userId?: string | null
} = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useClientSearchParams()
  const [query, setQuery] = useState("")
  const prevPathnameRef = useRef(pathname)

  const [idleOpen, setIdleOpen] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [recentlyViewed, setRecentlyViewed] = useState<NavSearchPersonalizationListing[]>([])
  const [recentBrands, setRecentBrands] = useState<NavSearchPersonalizationBrand[]>([])
  const [personalizationLoaded, setPersonalizationLoaded] = useState(false)
  const [suggestedPool, setSuggestedPool] = useState<NavSuggestedSurfboardPoolRow[]>([])
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
    setPersonalizationLoaded(false)
    setRecentlyViewed([])
    setRecentBrands([])
    setRecentSearches([])
  }, [userId])

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
      const engagedIdsSorted =
        suggestedSurfboardsMode === "popular"
          ? Object.entries(readNavSuggestedListingEngagement())
              .filter(([, n]) => n > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([id]) => id)
              .slice(0, 12)
          : []

      const res = await fetch(
        `/api/nav/suggested-surfboards?mode=${encodeURIComponent(suggestedSurfboardsMode)}`,
      )
      if (!res.ok) throw new Error("Failed to load suggested surfboards")
      const json = (await res.json()) as {
        data?: { rows?: NavSuggestedSurfboardPoolRow[] }
      }
      let merged: NavSuggestedSurfboardPoolRow[] = json.data?.rows ?? []

      if (suggestedSurfboardsMode === "popular" && engagedIdsSorted.length > 0) {
        const poolIds = new Set(merged.map((r) => r.id))
        const missingEngaged = engagedIdsSorted.filter((id) => !poolIds.has(id))
        if (missingEngaged.length > 0) {
          const extraRes = await fetch(
            `/api/nav/suggested-surfboards/by-ids?ids=${encodeURIComponent(missingEngaged.join(","))}`,
          )
          if (extraRes.ok) {
            const extraJson = (await extraRes.json()) as {
              data?: { rows?: NavSuggestedSurfboardPoolRow[] }
            }
            for (const row of extraJson.data?.rows ?? []) {
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
      const res = await fetch(
        `/api/nav/suggested-surfboards/by-ids?ids=${encodeURIComponent(listingId)}`,
      )
      if (!res.ok) return
      const json = (await res.json()) as {
        data?: { rows?: NavSuggestedSurfboardPoolRow[] }
      }
      const row = json.data?.rows?.[0]
      if (!row) return
      setSuggestedPool((prev) => {
        if (prev.some((r) => r.id === listingId)) return prev
        return [...prev, row]
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

  const loadPersonalization = useCallback(async () => {
    if (!userId) {
      setRecentSearches(getRecentSearches())
      setRecentlyViewed([])
      setRecentBrands(localRecentBrandsToDisplay(readRecentNavBrands()))
      setPersonalizationLoaded(true)
      return
    }

    setPersonalizationLoaded(false)
    try {
      const result = await getNavSearchPersonalizationAction()
      if ("error" in result) {
        setRecentSearches(getRecentSearches())
        setRecentlyViewed([])
        setRecentBrands(localRecentBrandsToDisplay(readRecentNavBrands()))
      } else {
        setRecentSearches(result.recentSearches)
        setRecentlyViewed(result.recentlyViewed)
        setRecentBrands(result.recentlyViewedBrands)
      }
    } catch {
      setRecentSearches(getRecentSearches())
      setRecentlyViewed([])
      setRecentBrands(localRecentBrandsToDisplay(readRecentNavBrands()))
    } finally {
      setPersonalizationLoaded(true)
    }
  }, [userId])

  const handleIdleFocus = useCallback(() => {
    if (query.trim().length > 0) return
    void loadPersonalization()
    setIdleOpen(true)
  }, [query, loadPersonalization])

  useEffect(() => {
    if (!idleOpen || query.trim().length > 0) return
    if (userId && !personalizationLoaded) return
    const hasPersonalization =
      recentSearches.length > 0 ||
      recentlyViewed.length > 0 ||
      recentBrands.length > 0
    if (!hasPersonalization) fetchSuggested()
  }, [
    idleOpen,
    query,
    userId,
    personalizationLoaded,
    recentSearches.length,
    recentlyViewed.length,
    recentBrands.length,
    fetchSuggested,
  ])

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

  const persistRecentBrand = useCallback(
    (brand: { name: string; slug: string | null; logoUrl: string | null }) => {
      pushRecentNavBrand({
        name: brand.name,
        slug: brand.slug,
        logoUrl: brand.logoUrl,
      })

      const slug = brand.slug?.trim()
      if (slug) {
        setRecentBrands((prev) => {
          const next: NavSearchPersonalizationBrand = {
            id: slug,
            slug,
            name: brand.name.trim(),
            logoUrl: brand.logoUrl,
          }
          return [
            next,
            ...prev.filter((row) => row.slug.toLowerCase() !== slug.toLowerCase()),
          ].slice(0, 10)
        })
      }

      if (userId) {
        void recordNavRecentlyViewedBrandAction({
          name: brand.name,
          slug: brand.slug,
        })
      }
    },
    [userId],
  )

  const persistRecentSearch = useCallback(
    (term: string) => {
      saveRecentSearch(term)
      if (userId) {
        void recordNavSearchPersonalizationQueryAction(term)
      }
    },
    [userId],
  )

  const runSearch = useCallback(
    (q: string) => {
      const term = q.trim()
      if (!term) return
      persistRecentSearch(term)
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
    [router, pathname, searchParams, persistRecentSearch],
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
    if (userId) {
      void removeNavSearchPersonalizationQueryAction(term).then(() => {
        setRecentSearches((prev) =>
          prev.filter((s) => s.toLowerCase() !== term.toLowerCase()),
        )
      })
    } else {
      removeRecentSearch(term)
      setRecentSearches(getRecentSearches())
    }
  }

  const showIdleDropdown = idleOpen && query.trim().length === 0
  const showPersonalization =
    recentSearches.length > 0 || recentlyViewed.length > 0
  const showSuggestedFallback =
    personalizationLoaded &&
    !showPersonalization &&
    suggestedLoaded &&
    suggestedListings.length > 0
  const showPersonalizationSkeleton =
    userId && idleOpen && !personalizationLoaded && !showPersonalization

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
        {showPersonalizationSkeleton ? (
          <NavSearchPersonalizationSkeleton />
        ) : showPersonalization ? (
          <>
            {recentSearches.length > 0 ? (
              <>
                <NavSearchIdleSectionTitle title="Recent searches" />
                <ul>
                  {recentSearches.map((term) => (
                    <li key={term} className="group relative">
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/60"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => runSearch(term)}
                      >
                        <Search
                          className="h-4 w-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                          {term}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                        aria-label={`Remove "${term}"`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleRemoveRecent(term)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {recentlyViewed.length > 0 ? (
              <div
                className={cn(
                  recentSearches.length > 0 && "border-t border-border/60",
                )}
              >
                <NavSearchIdleSectionTitle title="Recently viewed listings" />
                <div className="flex gap-3 overflow-x-auto px-4 pb-3 pt-0.5 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {recentlyViewed.map((listing) => (
                    <NavSearchIdleRecentlyViewedTile
                      key={listing.id}
                      listing={listing}
                      onNavigate={() => setIdleOpen(false)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : !suggestedLoaded ? (
          <SuggestedSurfboardsSkeleton />
        ) : showSuggestedFallback ? (
          <>
            <NavSearchTopListingSectionHeader title="Suggested surfboards" />
            <ul className="py-1">
              {suggestedListings.map((listing) => (
                <li key={listing.id}>
                  <Link
                    href={listingDetailHref({
                      id: listing.id,
                      slug: listing.slug,
                      section: "surfboards",
                    })}
                    className={navSearchTopListingRowClassName}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      bumpNavSuggestedListingEngagement(listing.id)
                      setIdleOpen(false)
                    }}
                  >
                    <NavSearchTopListingThumb imageUrl={listing.imageUrl} />
                    <NavSearchTopListingText
                      title={capitalizeWords(listing.title)}
                      price={listing.price}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>,
      document.body,
    )

  const sharedSearchInputProps = {
    value: query,
    onChange: setQuery,
    onBrandStripPick: (
      brandName: string,
      resolved?: { catalogSlug: string } | null,
    ) => {
      persistRecentSearch(brandName)
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
    },
    onSelect: (text: string) => {
      persistRecentSearch(text)
      runSearch(text)
    },
    onNavigate: clearSearchAndStorage,
    onFocus: handleIdleFocus,
    placeholder: "Search surfboards…",
    section: "",
    className: "w-full",
    minLength: 2,
    analyticsSurface: "header_nav" as const,
    onMarketplaceTopListingNavigate: bumpNavSuggestedListingEngagement,
    showTextSuggestions: false,
    matchAnchorWidth: true,
  }

  if (variant === "mobile") {
    return (
      <>
        <form
          ref={formRef}
          className={cn(
            SITE_SEARCH_SHELL_CLASS,
            "min-w-0 flex-1 border-foreground/20 bg-white pl-3 pr-1 shadow-none focus-within:border-foreground/35",
          )}
          onSubmit={handleSubmit}
        >
          <div className="relative min-w-0 flex-1">
            <SearchInputWithSuggest
              {...sharedSearchInputProps}
              listboxId="nav-search-suggestions-mobile-nav"
              inputClassName={siteSearchInputClassName({ compact: true })}
            />
          </div>
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            aria-label="Search"
          >
            <Search className="h-4 w-4" aria-hidden />
          </Button>
        </form>
        {idleDropdown}
      </>
    )
  }

  return (
    <div className="hidden min-w-0 w-full flex-1 items-center px-2 md:flex">
      <SiteSearchBar ref={formRef} onSubmit={handleSubmit} className="w-full">
        <SearchInputWithSuggest
          {...sharedSearchInputProps}
          listboxId="header-nav-search-suggestions"
          inputClassName={siteSearchInputClassName()}
        />
      </SiteSearchBar>
      {idleDropdown}
    </div>
  )
}
