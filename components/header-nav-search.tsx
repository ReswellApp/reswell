"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Search, X } from "lucide-react"
import { SearchInputWithSuggest } from "@/components/search-input-with-suggest"
import { clearNavSearchQuery } from "@/lib/nav-search-storage"
import { goToCuratedSearchPage } from "@/lib/nav-curated-search"

/**
 * Desktop (md+): expandable search in the nav flex gap — does not overlap action buttons.
 * Keeps the bar clear after search or suggestion so users can start a new search immediately.
 */
export function HeaderNavSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState(false)
  const inputWrapRef = useRef<HTMLDivElement>(null)
  /** True when user opened search from the collapsed pill — focus input after mount (one click). */
  const focusInputAfterExpandRef = useRef(false)
  const prevPathnameRef = useRef(pathname)
  /** Only clear the bar when the route *enters* /search, not on every ?q= / filter change (avoids killing the suggest dropdown). */
  const prevPathForEnterSearchRef = useRef(pathname)

  const urlQ = pathname === "/search" ? (searchParams.get("q") ?? "").trim() : ""

  // When navigating onto /search, clear the bar once (URL still has q for results; input stays empty for the next search)
  useEffect(() => {
    const prev = prevPathForEnterSearchRef.current
    prevPathForEnterSearchRef.current = pathname
    if (pathname === "/search" && prev !== "/search") {
      setQuery("")
      setExpanded(true)
    }
  }, [pathname])

  // Clear when navigating away from /search (e.g. clicked a listing)
  useEffect(() => {
    const prev = prevPathnameRef.current
    prevPathnameRef.current = pathname
    if (prev === "/search" && pathname !== "/search") {
      setQuery("")
      clearNavSearchQuery()
    }
  }, [pathname])

  // After expanding from the pill, focus the search input (the opening click doesn’t reach the new input).
  useLayoutEffect(() => {
    if (!expanded || !focusInputAfterExpandRef.current) return
    focusInputAfterExpandRef.current = false
    inputWrapRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
  }, [expanded])

  const runSearch = useCallback(
    (q: string) => {
      const term = q.trim()
      if (!term) return
      const section = pathname === "/search" ? searchParams.get("section") : null
      const params = new URLSearchParams()
      params.set("q", term)
      if (section && section !== "all") params.set("section", section)
      setExpanded(true)
      router.push(`/search?${params.toString()}`)
      setQuery("")
      clearNavSearchQuery()
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

  const handleCollapse = () => {
    if (pathname === "/search") return
    setExpanded(false)
    setQuery("")
    clearNavSearchQuery()
  }

  const showBar = expanded || Boolean(query.trim()) || Boolean(urlQ)

  if (!showBar) {
    return (
      <div className="hidden min-w-0 w-full flex-1 items-center px-2 md:flex">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-full max-w-full justify-start gap-2.5 rounded-full border border-border/80 bg-muted/30 px-5 text-muted-foreground hover:bg-muted/60 hover:text-foreground sm:px-6"
          aria-label="Open search"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            focusInputAfterExpandRef.current = true
            setExpanded(true)
          }}
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="text-sm font-normal leading-none">Search marketplace…</span>
        </Button>
      </div>
    )
  }

  return (
    <div
      ref={inputWrapRef}
      className="hidden min-w-0 w-full flex-1 items-center px-2 md:flex"
    >
      <form
        onSubmit={handleSubmit}
        className="flex w-full min-w-0 items-center gap-2 rounded-full border border-border bg-background pl-1 pr-1 shadow-sm transition-shadow focus-within:border-cerulean/40 focus-within:ring-1 focus-within:ring-cerulean/20"
      >
        <div className="relative min-w-0 flex-1">
          <SearchInputWithSuggest
            value={query}
            onChange={setQuery}
            onSelect={(text) => {
              runSearch(text)
            }}
            onNavigate={clearSearchAndStorage}
            placeholder="Search gear, boards, wetsuits…"
            section=""
            listboxId="header-nav-search-suggestions"
            leftIcon={<Search className="h-4 w-4 text-muted-foreground" />}
            inputClassName="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            className="w-full"
            minLength={2}
          />
        </div>
        <Button type="submit" size="sm" className="h-8 shrink-0 rounded-full px-4">
          Search
        </Button>
        {pathname !== "/search" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            aria-label="Collapse search"
            onClick={handleCollapse}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </form>
    </div>
  )
}
