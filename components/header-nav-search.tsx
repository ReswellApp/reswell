"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Search, X } from "lucide-react"
import { SearchInputWithSuggest } from "@/components/search-input-with-suggest"
import { clearNavSearchQuery, readNavSearchQuery, writeNavSearchQuery } from "@/lib/nav-search-storage"

/**
 * Desktop (md+): expandable search in the nav flex gap — does not overlap action buttons.
 * Stays open with the last query after search (URL on /search + sessionStorage elsewhere).
 */
export function HeaderNavSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState(false)
  const inputWrapRef = useRef<HTMLDivElement>(null)

  const urlQ = pathname === "/search" ? (searchParams.get("q") ?? "").trim() : ""

  // Sync from URL on /search
  useEffect(() => {
    if (pathname === "/search") {
      const q = (searchParams.get("q") ?? "").trim()
      setQuery(q)
      setExpanded(true)
      if (q) writeNavSearchQuery(q)
    }
  }, [pathname, searchParams])

  // Restore from session when leaving /search (keep bar expanded if we have a remembered query)
  useEffect(() => {
    if (pathname === "/search") return
    const saved = readNavSearchQuery()
    if (saved) {
      setQuery(saved)
      setExpanded(true)
    }
  }, [pathname])

  const runSearch = useCallback(
    (q: string) => {
      const term = q.trim()
      if (!term) return
      const section = pathname === "/search" ? searchParams.get("section") : null
      const params = new URLSearchParams()
      params.set("q", term)
      if (section && section !== "all") params.set("section", section)
      writeNavSearchQuery(term)
      setExpanded(true)
      router.push(`/search?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
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
      <div className="hidden min-w-0 flex-1 items-center justify-center px-2 md:flex">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-2 rounded-full border border-border/80 bg-muted/30 px-3 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          aria-label="Open search"
          onClick={() => setExpanded(true)}
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="text-sm font-normal">Search marketplace…</span>
        </Button>
      </div>
    )
  }

  return (
    <div
      ref={inputWrapRef}
      className="hidden min-w-0 flex-1 items-center px-2 md:flex md:max-w-2xl lg:max-w-3xl"
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
              setQuery(text)
              runSearch(text)
            }}
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
