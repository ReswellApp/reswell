"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SiteSearchShell, siteSearchInputClassName } from "@/components/site-search-bar"
import { cn } from "@/lib/utils"
import { searchBoardTalkReviewsCatalogSuggestAction } from "@/app/actions/board-talk-reviews"
import type { BoardTalkReviewsSearchSuggestResult } from "@/lib/services/boardTalkReviewsSearch"

const DEBOUNCE_MS = 200
const MIN_QUERY_LENGTH = 1

export type BoardTalkReviewsCatalogFilter = {
  brandSlug: string | null
  modelSlug: string | null
}

type BoardTalkReviewsSearchProps = {
  value: string
  catalogFilter: BoardTalkReviewsCatalogFilter
  onValueChange: (next: string) => void
  onCatalogFilterChange: (next: BoardTalkReviewsCatalogFilter) => void
  className?: string
  placeholder?: string
}

type DropdownItem =
  | { kind: "brand"; index: number; name: string; slug: string }
  | {
      kind: "model"
      index: number
      name: string
      brandName: string
      brandSlug: string
      modelSlug: string
    }

function flattenResults(results: BoardTalkReviewsSearchSuggestResult | null): DropdownItem[] {
  if (!results) return []
  const items: DropdownItem[] = []
  results.brands.forEach((row, index) => {
    items.push({ kind: "brand", index, name: row.name, slug: row.slug })
  })
  results.models.forEach((row, index) => {
    items.push({
      kind: "model",
      index,
      name: row.name,
      brandName: row.brandName,
      brandSlug: row.brandSlug,
      modelSlug: row.modelSlug,
    })
  })
  return items
}

export function BoardTalkReviewsSearch({
  value,
  catalogFilter,
  onValueChange,
  onCatalogFilterChange,
  className,
  placeholder = "Search brand, model, or review…",
}: BoardTalkReviewsSearchProps) {
  const [open, setOpen] = React.useState(false)
  const [results, setResults] = React.useState<BoardTalkReviewsSearchSuggestResult | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [highlight, setHighlight] = React.useState(0)
  const [dropdownRect, setDropdownRect] = React.useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const generationRef = React.useRef(0)

  const listId = React.useId()
  const q = value.trim()
  const flatItems = React.useMemo(() => flattenResults(results), [results])
  const hasResults = flatItems.length > 0
  const showDropdown = open && q.length >= MIN_QUERY_LENGTH && (loading || hasResults)
  const brandItems = results?.brands ?? []
  const modelItems = results?.models ?? []
  const hasCatalogFilter = Boolean(catalogFilter.brandSlug || catalogFilter.modelSlug)

  React.useEffect(() => {
    setHighlight(0)
  }, [results])

  const invalidatePending = React.useCallback(() => {
    generationRef.current += 1
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  React.useEffect(() => {
    if (q.length < MIN_QUERY_LENGTH) {
      invalidatePending()
      setResults(null)
      setLoading(false)
      setOpen(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const gen = ++generationRef.current
      void (async () => {
        if (gen !== generationRef.current) return
        setLoading(true)
        try {
          const next = await searchBoardTalkReviewsCatalogSuggestAction(q)
          if (gen !== generationRef.current) return
          setResults(next)
          const hasAny = next.brands.length > 0 || next.models.length > 0
          if (!hasAny) {
            setOpen(false)
            return
          }
          const isFocused =
            Boolean(inputRef.current && document.activeElement === inputRef.current)
          setOpen(isFocused)
        } finally {
          if (gen === generationRef.current) setLoading(false)
        }
      })()
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [q, invalidatePending])

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

  const selectBrand = React.useCallback(
    (name: string, slug: string) => {
      invalidatePending()
      setOpen(false)
      onValueChange(name)
      onCatalogFilterChange({ brandSlug: slug, modelSlug: null })
    },
    [invalidatePending, onCatalogFilterChange, onValueChange],
  )

  const selectModel = React.useCallback(
    (brandName: string, brandSlug: string, modelName: string, modelSlug: string) => {
      invalidatePending()
      setOpen(false)
      onValueChange(`${brandName} · ${modelName}`)
      onCatalogFilterChange({ brandSlug, modelSlug })
    },
    [invalidatePending, onCatalogFilterChange, onValueChange],
  )

  function handleSelectItem(item: DropdownItem) {
    if (item.kind === "brand") {
      selectBrand(item.name, item.slug)
      return
    }
    selectModel(item.brandName, item.brandSlug, item.name, item.modelSlug)
  }

  function handleInputChange(next: string) {
    onValueChange(next)
    if (hasCatalogFilter) {
      onCatalogFilterChange({ brandSlug: null, modelSlug: null })
    }
    if (next.trim().length >= MIN_QUERY_LENGTH) {
      setOpen(true)
    }
  }

  function clearSearch() {
    invalidatePending()
    setOpen(false)
    onValueChange("")
    onCatalogFilterChange({ brandSlug: null, modelSlug: null })
    inputRef.current?.focus()
  }

  const panelWidth = dropdownRect
    ? Math.min(Math.max(dropdownRect.width, 320), 560)
    : 420
  const panelLeft = dropdownRect
    ? Math.min(
        dropdownRect.left,
        typeof window !== "undefined" ? window.innerWidth - panelWidth - 16 : dropdownRect.left,
      )
    : 0

  let flatIndex = -1

  const dropdownPanel =
    showDropdown &&
    dropdownRect &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={dropdownRef}
        id={listId}
        role="listbox"
        aria-label="Brand and model matches"
        className="fixed z-[100] overflow-hidden rounded-2xl border border-border/80 bg-popover text-popover-foreground shadow-xl shadow-black/10"
        style={{
          top: dropdownRect.top,
          left: panelLeft,
          width: panelWidth,
          maxHeight: "min(60vh, 480px)",
        }}
      >
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Catalog
          </p>
          <p className="text-xs text-muted-foreground">Pick a brand or model</p>
        </div>

        {loading && !hasResults ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Searching catalog…</div>
        ) : (
          <div className="max-h-[min(50vh,400px)] overflow-y-auto py-1">
            {brandItems.length > 0 ? (
              <div>
                <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Brands
                </p>
                <ul>
                  {brandItems.map((row) => {
                    flatIndex += 1
                    const itemIndex = flatIndex
                    return (
                      <li key={row.id} role="none">
                        <button
                          type="button"
                          role="option"
                          aria-selected={itemIndex === highlight}
                          className={cn(
                            "flex w-full cursor-pointer select-none items-center gap-3 px-4 py-2.5 text-left text-sm outline-none min-h-touch transition-colors hover:bg-muted/80",
                            itemIndex === highlight && "bg-muted/80",
                          )}
                          onMouseEnter={() => setHighlight(itemIndex)}
                          onMouseDown={(ev) => {
                            ev.preventDefault()
                            selectBrand(row.name, row.slug)
                          }}
                        >
                          <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                            {row.name}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}

            {modelItems.length > 0 ? (
              <div className={brandItems.length > 0 ? "border-t border-border/60" : undefined}>
                <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Models
                </p>
                <ul>
                  {modelItems.map((row) => {
                    flatIndex += 1
                    const itemIndex = flatIndex
                    return (
                      <li key={row.id} role="none">
                        <button
                          type="button"
                          role="option"
                          aria-selected={itemIndex === highlight}
                          className={cn(
                            "flex w-full cursor-pointer select-none flex-col gap-0.5 px-4 py-2.5 text-left text-sm outline-none min-h-touch transition-colors hover:bg-muted/80",
                            itemIndex === highlight && "bg-muted/80",
                          )}
                          onMouseEnter={() => setHighlight(itemIndex)}
                          onMouseDown={(ev) => {
                            ev.preventDefault()
                            selectModel(row.brandName, row.brandSlug, row.name, row.modelSlug)
                          }}
                        >
                          <span className="truncate font-semibold text-foreground">{row.name}</span>
                          <span className="truncate text-xs text-muted-foreground">{row.brandName}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>,
      document.body,
    )

  return (
    <div ref={containerRef} className={cn("w-full min-w-0 flex-1", className)}>
      <SiteSearchShell actionSlot={null}>
        <Input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={() => {
            if (q.length >= MIN_QUERY_LENGTH && (loading || hasResults)) setOpen(true)
          }}
          onKeyDown={(event) => {
            if (!open || flatItems.length === 0) return
            if (event.key === "ArrowDown") {
              event.preventDefault()
              setHighlight((prev) => (prev + 1) % flatItems.length)
            } else if (event.key === "ArrowUp") {
              event.preventDefault()
              setHighlight((prev) => (prev - 1 + flatItems.length) % flatItems.length)
            } else if (event.key === "Enter") {
              event.preventDefault()
              const item = flatItems[highlight]
              if (item) handleSelectItem(item)
            } else if (event.key === "Escape") {
              setOpen(false)
            }
          }}
          placeholder={placeholder}
          aria-label="Search board reviews"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listId : undefined}
          aria-autocomplete="list"
          role="combobox"
          autoComplete="off"
          className={cn(
            siteSearchInputClassName(),
            value && "pr-10",
            value && "[&::-webkit-search-cancel-button]:hidden [&::-moz-search-clear]:hidden",
          )}
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clearSearch}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </SiteSearchShell>
      {dropdownPanel}
    </div>
  )
}
