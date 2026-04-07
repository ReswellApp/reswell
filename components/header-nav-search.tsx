"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Clock, X, TrendingUp } from "lucide-react"
import { createPortal } from "react-dom"
import { SearchInputWithSuggest } from "@/components/search-input-with-suggest"
import { clearNavSearchQuery } from "@/lib/nav-search-storage"
import { goToCuratedSearchPage } from "@/lib/nav-curated-search"
import { createClient } from "@/lib/supabase/client"
import { capitalizeWords } from "@/lib/listing-labels"
import { cn } from "@/lib/utils"
import { listingDetailHref } from "@/lib/listing-href"

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

export function HeaderNavSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState("")
  const prevPathnameRef = useRef(pathname)
  const prevPathForEnterSearchRef = useRef(pathname)

  const [idleOpen, setIdleOpen] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [suggestedListings, setSuggestedListings] = useState<SuggestedListing[]>([])
  const [suggestedLoaded, setSuggestedLoaded] = useState(false)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const idleDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = prevPathForEnterSearchRef.current
    prevPathForEnterSearchRef.current = pathname
    if (isSearchResultsPath(pathname) && !isSearchResultsPath(prev)) {
      setQuery("")
    }
  }, [pathname])

  useEffect(() => {
    const prev = prevPathnameRef.current
    prevPathnameRef.current = pathname
    if (isSearchResultsPath(prev) && !isSearchResultsPath(pathname)) {
      setQuery("")
      clearNavSearchQuery()
    }
  }, [pathname])

  const fetchSuggested = useCallback(async () => {
    if (suggestedLoaded) return
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from("listings")
        .select("id, slug, title, price, listing_images (url, is_primary)")
        .eq("status", "active")
        .eq("section", "surfboards")
        .order("created_at", { ascending: false })
        .limit(3)
      if (data) {
        setSuggestedListings(
          data.map((l: any) => {
            const imgs = l.listing_images ?? []
            const primary = imgs.find((i: any) => i.is_primary)
            return {
              id: l.id,
              slug: l.slug ?? null,
              title: l.title,
              price: l.price,
              imageUrl: primary?.url ?? imgs[0]?.url ?? null,
            }
          }),
        )
      }
      setSuggestedLoaded(true)
    } catch {
      setSuggestedLoaded(true)
    }
  }, [suggestedLoaded])

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
      router.push(`/search?${params.toString()}`)
      setQuery("")
      clearNavSearchQuery()
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

  const panelWidth = dropdownRect
    ? Math.min(Math.max(dropdownRect.width, 380), 520)
    : 400
  const panelLeft = dropdownRect
    ? Math.min(dropdownRect.left, typeof window !== "undefined" ? window.innerWidth - panelWidth - 16 : dropdownRect.left)
    : 0

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
                    onClick={() => setIdleOpen(false)}
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
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="flex w-full min-w-0 items-center gap-2 rounded-full border border-border bg-muted/40 pl-2 pr-1.5 transition-shadow focus-within:bg-background focus-within:border-cerulean/40 focus-within:ring-2 focus-within:ring-cerulean/15 focus-within:shadow-sm"
      >
        <div className="relative min-w-0 flex-1">
          <SearchInputWithSuggest
            value={query}
            onChange={setQuery}
            onSelect={(text) => {
              saveRecentSearch(text)
              runSearch(text)
            }}
            onNavigate={clearSearchAndStorage}
            onFocus={handleIdleFocus}
            placeholder="Search surfboards…"
            section=""
            listboxId="header-nav-search-suggestions"
            inputClassName="h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-[15px] pl-4"
            className="w-full"
            minLength={2}
          />
        </div>
        <Button type="submit" size="sm" className="h-10 shrink-0 rounded-full px-5 text-[14px]">
          Search
        </Button>
      </form>
      {idleDropdown}
    </div>
  )
}
