"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSurfpacksBrowseRouter } from "@/hooks/use-surfpacks-browse-router"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BoardsListingsSearchField } from "@/components/boards-listings-search-field"
import {
  SiteSearchFormSubmitButton,
  SiteSearchShell,
  siteFilterSelectTriggerClassName,
  siteSearchInputClassName,
} from "@/components/site-search-bar"
import { SURFPACKS_BROWSE_DEFAULT_SORT } from "@/lib/surfpacks-browse-metadata"

export const surfpackSortOptions = [
  { value: SURFPACKS_BROWSE_DEFAULT_SORT, label: "Newest" },
  { value: "price-low", label: "Price: Low → High" },
  { value: "price-high", label: "Price: High → Low" },
]

const DEBOUNCE_MS = 380

type Props = {
  resultCount?: number
  activeFilterCount: number
  onOpenMobileFilters: () => void
  desktopFiltersOpen?: boolean
  onToggleDesktopFilters?: () => void
  transitionStart?: (cb: () => void) => void
}

/** Slim browse toolbar for `/surfpacks`: keyword search, sort, plus Filter triggers. */
export function SurfpacksBrowseFilterToolbar({
  resultCount,
  activeFilterCount,
  onOpenMobileFilters,
  desktopFiltersOpen = false,
  onToggleDesktopFilters,
  transitionStart,
}: Props) {
  const { navigate, searchParams } = useSurfpacksBrowseRouter(transitionStart)

  const urlQ = searchParams.get("q") ?? ""
  const [q, setQ] = useState(urlQ)
  const sort = searchParams.get("sort") ?? SURFPACKS_BROWSE_DEFAULT_SORT

  const skipQDebounce = useRef(true)
  const isFocusedRef = useRef(false)
  const qRef = useRef(q)
  const lastCommittedQRef = useRef(urlQ)

  qRef.current = q

  useEffect(() => {
    if (urlQ === "" && lastCommittedQRef.current !== "") {
      setQ("")
      lastCommittedQRef.current = ""
      skipQDebounce.current = true
      return
    }

    if (isFocusedRef.current) return

    setQ((prev) => {
      if (prev === urlQ) return prev
      skipQDebounce.current = true
      lastCommittedQRef.current = urlQ
      return urlQ
    })
  }, [urlQ])

  const urlQRef = useRef(urlQ)
  urlQRef.current = urlQ

  const commitSearch = useCallback(
    (query: string) => {
      const trimmed = query.trim()
      const current = urlQRef.current.trim()
      if (trimmed === current) return
      skipQDebounce.current = true
      lastCommittedQRef.current = trimmed
      navigate((p) => {
        if (trimmed) p.set("q", trimmed)
        else p.delete("q")
      })
    },
    [navigate],
  )

  const commitSearchRef = useRef(commitSearch)
  commitSearchRef.current = commitSearch

  useEffect(() => {
    if (skipQDebounce.current) {
      skipQDebounce.current = false
      return
    }
    const t = setTimeout(() => {
      commitSearchRef.current(qRef.current)
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [q])

  const sortSelect = (
    <Select
      name="sort"
      value={sort}
      onValueChange={(v) =>
        navigate((p) => (v === SURFPACKS_BROWSE_DEFAULT_SORT ? p.delete("sort") : p.set("sort", v)))
      }
    >
      <SelectTrigger className={siteFilterSelectTriggerClassName()}>
        <SelectValue placeholder="Sort" />
      </SelectTrigger>
      <SelectContent>
        {surfpackSortOptions.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        commitSearch(qRef.current)
      }}
      className="flex w-full min-w-0 flex-col gap-3"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 md:flex-row md:items-center md:gap-3">
        <div className="order-1 min-w-0 w-full md:order-2 md:flex-1">
          <SiteSearchShell
            actionSlot={<SiteSearchFormSubmitButton>Search</SiteSearchFormSubmitButton>}
          >
            <BoardsListingsSearchField
              value={q}
              onChange={setQ}
              name="q"
              placeholder="Search title, brand, details…"
              className="w-full"
              inputClassName={siteSearchInputClassName()}
              onFocus={() => {
                isFocusedRef.current = true
              }}
              onBlur={() => {
                isFocusedRef.current = false
                commitSearchRef.current(qRef.current)
              }}
            />
          </SiteSearchShell>
        </div>

        <div className="order-2 flex items-center gap-3 md:contents">
          <div className="flex shrink-0 items-center md:order-1">
            <Button
              type="button"
              variant="outline"
              className="shrink-0 gap-2 rounded-full md:hidden"
              onClick={onOpenMobileFilters}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filter
              {activeFilterCount > 0 ? (
                <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[11px] tabular-nums">
                  {activeFilterCount}
                </Badge>
              ) : null}
            </Button>

            <button
              type="button"
              aria-expanded={desktopFiltersOpen}
              aria-label={desktopFiltersOpen ? "Hide filters" : "Show filters"}
              onClick={onToggleDesktopFilters}
              className="hidden shrink-0 items-center gap-2.5 rounded-md px-1 py-1 text-base font-semibold text-foreground transition-colors hover:text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:inline-flex"
            >
              Filter
              <SlidersHorizontal className="h-[18px] w-[18px] stroke-[1.75]" aria-hidden="true" />
              {activeFilterCount > 0 ? (
                <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[11px] tabular-nums">
                  {activeFilterCount}
                </Badge>
              ) : null}
            </button>
          </div>

          <div className="min-w-0 flex-1 md:order-3 md:w-[150px] md:flex-none md:shrink-0">
            {sortSelect}
          </div>
        </div>

        {resultCount != null ? (
          <span className="order-3 hidden shrink-0 text-sm text-muted-foreground md:order-4 lg:inline">
            {resultCount.toLocaleString()} {resultCount === 1 ? "surfpack" : "surfpacks"}
          </span>
        ) : null}
      </div>
    </form>
  )
}
