"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
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
import { BOARDS_BROWSE_DEFAULT_SORT } from "@/lib/marketplace-slug-metadata"

export const boardSortOptions = [
  { value: BOARDS_BROWSE_DEFAULT_SORT, label: "Newest" },
  { value: "price-newest", label: "Highest price" },
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

/** Slim browse toolbar: keyword search, sort, plus the Filter triggers. */
export function BoardsBrowseFilterToolbar({
  resultCount,
  activeFilterCount,
  onOpenMobileFilters,
  desktopFiltersOpen = true,
  onToggleDesktopFilters,
  transitionStart,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [q, setQ] = useState(searchParams.get("q") ?? "")
  const sort = searchParams.get("sort") ?? BOARDS_BROWSE_DEFAULT_SORT

  const skipQDebounce = useRef(true)

  useEffect(() => {
    setQ(searchParams.get("q") ?? "")
    skipQDebounce.current = true
  }, [searchParams])

  const navigate = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())
      mutate(params)
      params.delete("page")
      const qs = params.toString()
      const run = () => router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
      if (transitionStart) transitionStart(run)
      else run()
    },
    [pathname, router, searchParams, transitionStart],
  )

  useEffect(() => {
    if (skipQDebounce.current) {
      skipQDebounce.current = false
      return
    }
    const t = setTimeout(() => {
      navigate((p) => {
        if (q.trim()) p.set("q", q.trim())
        else p.delete("q")
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [q, navigate])

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="flex w-full min-w-0 flex-col gap-3"
    >
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
        <div className="flex shrink-0 items-center">
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

        <div className="min-w-0 flex-1">
          <SiteSearchShell
            actionSlot={<SiteSearchFormSubmitButton>Search</SiteSearchFormSubmitButton>}
          >
            <BoardsListingsSearchField
              value={q}
              onChange={setQ}
              name="q"
              className="w-full"
              inputClassName={siteSearchInputClassName()}
            />
          </SiteSearchShell>
        </div>

        <div className="w-[150px] shrink-0">
          <Select
            name="sort"
            value={sort}
            onValueChange={(v) =>
              navigate((p) => (v === BOARDS_BROWSE_DEFAULT_SORT ? p.delete("sort") : p.set("sort", v)))
            }
          >
            <SelectTrigger className={siteFilterSelectTriggerClassName()}>
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {boardSortOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {resultCount != null ? (
          <span className="hidden shrink-0 text-sm text-muted-foreground lg:inline">
            {resultCount.toLocaleString()} {resultCount === 1 ? "board" : "boards"}
          </span>
        ) : null}
      </div>
    </form>
  )
}
