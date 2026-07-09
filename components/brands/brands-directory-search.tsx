"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import {
  SiteSearchFormSubmitButton,
  SiteSearchShell,
  siteSearchInputClassName,
} from "@/components/site-search-bar"
import { cn } from "@/lib/utils"
import type { BrandRow } from "@/lib/brands/types"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { searchBrandsCatalogSuggest } from "@/app/actions/marketplace"
import type { BrandCatalogSuggestRow } from "@/lib/services/brandDirectorySearch"
import { recordBrandDirectorySearchAnalytics } from "@/app/actions/brand-directory-search-analytics"

const BROWSE_LIMIT = 36
const SUGGEST_DEBOUNCE_MS = 280

function browseBrands(brands: BrandRow[]): BrandRow[] {
  return [...brands].sort((a, b) => a.name.localeCompare(b.name)).slice(0, BROWSE_LIMIT)
}

type BrandsDirectorySearchProps = {
  brands: BrandRow[]
  className?: string
}

/**
 * Brand-directory typeahead: uses the same `searchBrandsCatalogSuggest` pipeline as nav/sell
 * (Elasticsearch when configured). Logs to `reswell_search_analytics` with `search_surface: brand_directory`.
 */
export function BrandsDirectorySearch({ brands, className }: BrandsDirectorySearchProps) {
  const router = useRouter()
  const [value, setValue] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [highlight, setHighlight] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const listId = React.useId()
  const [dropdownRect, setDropdownRect] = React.useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  const [suggestedRows, setSuggestedRows] = React.useState<BrandCatalogSuggestRow[] | null>(null)
  const [suggestLoading, setSuggestLoading] = React.useState(false)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestGen = React.useRef(0)

  const q = value.trim()
  const browseList = React.useMemo(() => browseBrands(brands), [brands])
  const showBrowse = !q

  const listLength = showBrowse ? browseList.length : (suggestedRows?.length ?? 0)
  const showNoMatch =
    open &&
    q.length > 0 &&
    !suggestLoading &&
    brands.length > 0 &&
    (suggestedRows?.length ?? 0) === 0
  const showDropdown =
    open &&
    brands.length > 0 &&
    (showBrowse
      ? browseList.length > 0
      : suggestLoading || showNoMatch || (suggestedRows?.length ?? 0) > 0)

  React.useEffect(() => {
    const gen = ++suggestGen.current
    if (!q) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      setSuggestedRows(null)
      setSuggestLoading(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSuggestLoading(true)
    setSuggestedRows([])

    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const { rows, meta } = await searchBrandsCatalogSuggest(q)
          if (gen !== suggestGen.current) return
          setSuggestedRows(rows)
          void recordBrandDirectorySearchAnalytics({
            queryRaw: q,
            resultCount: rows.length,
            backend: meta.backend,
          })
        } finally {
          if (gen === suggestGen.current) setSuggestLoading(false)
        }
      })()
    }, SUGGEST_DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [q])

  React.useEffect(() => {
    setHighlight(0)
  }, [value, showBrowse, listLength, suggestedRows?.length])

  React.useEffect(() => {
    if (!showDropdown || !containerRef.current || typeof document === "undefined") {
      setDropdownRect(null)
      return
    }
    const el = containerRef.current
    const update = () => {
      const rect = el.getBoundingClientRect()
      setDropdownRect({ top: rect.bottom + 8, left: rect.left, width: rect.width })
    }
    update()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [showDropdown])

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node
      if (containerRef.current?.contains(t)) return
      if (dropdownRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function goToBrand(slug: string) {
    router.push(`${BRANDS_BASE}/${encodeURIComponent(slug)}`)
    setOpen(false)
    setValue("")
  }

  function searchMarketplaceForQuery(query: string) {
    const t = query.trim()
    if (!t) return
    router.push(`/search?q=${encodeURIComponent(t)}`)
    setOpen(false)
    setValue("")
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    searchMarketplaceForQuery(value)
  }

  const panelWidth = dropdownRect
    ? Math.min(Math.max(dropdownRect.width, 320), 480)
    : 360
  const panelLeft = dropdownRect
    ? Math.min(
        dropdownRect.left,
        typeof window !== "undefined" ? window.innerWidth - panelWidth - 16 : dropdownRect.left,
      )
    : 0

  const dropdownPanel =
    showDropdown &&
    dropdownRect &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={dropdownRef}
        id={listId}
        role="listbox"
        aria-label="Brand directory matches"
        className="fixed z-[100] overflow-hidden rounded-2xl border border-border/80 bg-popover text-popover-foreground shadow-xl shadow-black/10"
        style={{
          top: dropdownRect.top,
          left: panelLeft,
          width: panelWidth,
          maxHeight: "min(55vh, 420px)",
        }}
      >
        <div className="border-b border-border/60 bg-muted/20 px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Brands
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Choose a row for a profile, or press Search for listings
          </p>
        </div>
        {showBrowse ? (
          <ul className="max-h-[min(45vh,340px)] overflow-y-auto py-1">
            {browseList.map((b, i) => (
              <li key={b.id} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  className={cn(
                    "flex w-full cursor-pointer select-none items-center gap-3 px-4 py-2.5 text-left text-sm outline-none min-h-touch transition-colors hover:bg-muted/80",
                    i === highlight && "bg-muted/80",
                  )}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(ev) => {
                    ev.preventDefault()
                    goToBrand(b.slug)
                  }}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted text-sm font-semibold text-cerulean"
                    aria-hidden
                  >
                    {b.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                    {b.name}
                  </span>
                  {b.location_label ? (
                    <span className="hidden max-w-[38%] shrink-0 truncate text-xs text-muted-foreground sm:inline">
                      {b.location_label}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : suggestLoading && (suggestedRows?.length ?? 0) === 0 && !showNoMatch ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">Searching…</div>
        ) : showNoMatch ? (
          <div className="space-y-3 px-4 py-4">
            <p className="text-sm text-muted-foreground">
              No profile in this directory for &quot;{q}&quot;. You can still search the marketplace for
              that name.
            </p>
            <button
              type="button"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 min-h-touch"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => searchMarketplaceForQuery(value)}
            >
              Search listings for &quot;{q}&quot;
            </button>
          </div>
        ) : (
          <ul className="max-h-[min(45vh,340px)] overflow-y-auto py-1">
            {(suggestedRows ?? []).map((b, i) => (
              <li key={b.id} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  className={cn(
                    "flex w-full cursor-pointer select-none items-center gap-3 px-4 py-2.5 text-left text-sm outline-none min-h-touch transition-colors hover:bg-muted/80",
                    i === highlight && "bg-muted/80",
                  )}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(ev) => {
                    ev.preventDefault()
                    goToBrand(b.slug)
                  }}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted text-sm font-semibold text-cerulean"
                    aria-hidden
                  >
                    {b.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                    {b.name}
                  </span>
                  {b.location_label ? (
                    <span className="hidden max-w-[38%] shrink-0 truncate text-xs text-muted-foreground sm:inline">
                      {b.location_label}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>,
      document.body,
    )

  const highlightMax = showBrowse ? browseList.length - 1 : (suggestedRows?.length ?? 0) - 1

  return (
    <div className={cn("w-full max-w-xl", className)}>
      <p className="mb-2 text-center text-sm font-medium text-foreground">Search the brand directory</p>
      <div ref={containerRef}>
        <form onSubmit={handleSubmit}>
          <SiteSearchShell
            actionSlot={
              <SiteSearchFormSubmitButton type="submit" aria-label="Open brand profile or search marketplace">
                Search
              </SiteSearchFormSubmitButton>
            }
          >
            <Input
              type="search"
              name="brand-directory-q"
              enterKeyHint="search"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              placeholder="Search brands or type any name…"
              aria-label="Brand directory or freeform marketplace search"
              aria-autocomplete="list"
              aria-expanded={showDropdown}
              aria-controls={showDropdown ? listId : undefined}
              autoComplete="off"
              className={siteSearchInputClassName()}
              onKeyDown={(e) => {
                if (showNoMatch) {
                  if (e.key === "Escape") {
                    e.preventDefault()
                    setOpen(false)
                  }
                  return
                }
                if (!showDropdown) {
                  if (e.key === "Escape") setOpen(false)
                  return
                }
                if (showBrowse) {
                  if (browseList.length === 0) {
                    if (e.key === "Escape") setOpen(false)
                    return
                  }
                } else if (suggestLoading || (suggestedRows?.length ?? 0) === 0) {
                  if (e.key === "Escape") {
                    e.preventDefault()
                    setOpen(false)
                  }
                  return
                }
                if (e.key === "Escape") {
                  e.preventDefault()
                  setOpen(false)
                  return
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault()
                  setHighlight((h) => Math.min(h + 1, Math.max(0, highlightMax)))
                  return
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault()
                  setHighlight((h) => Math.max(h - 1, 0))
                  return
                }
                if (e.key === "Enter") {
                  if (open && !showNoMatch && q.length > 0 && highlightMax >= 0) {
                    e.preventDefault()
                    if (showBrowse) {
                      goToBrand(browseList[highlight].slug)
                    } else {
                      const row = suggestedRows?.[highlight]
                      if (row) goToBrand(row.slug)
                    }
                  }
                }
              }}
            />
          </SiteSearchShell>
        </form>
      </div>
      {dropdownPanel}
    </div>
  )
}
