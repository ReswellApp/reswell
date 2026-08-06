"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { createPortal } from "react-dom"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  NavSearchTopListingSectionHeader,
  navSearchTopListingMetaClassName,
  navSearchTopListingRowClassName,
  navSearchTopListingThumbClassName,
  navSearchTopListingTitleClassName,
} from "@/components/features/search/nav-search-top-listing-row"
import { getSuggestPanelLayout } from "@/components/search-input-with-suggest"
import {
  SiteSearchBar,
  siteSearchInputClassName,
} from "@/components/site-search-bar"
import {
  sellCatalogSearchCategoryLabel,
  sellCatalogSearchCategorySellPath,
  sellCatalogSearchRowBrandName,
  sellCatalogSearchRowCategory,
  sellCatalogSearchRowModelName,
  type SellCatalogSearchResult,
  type SellCatalogSearchResultRow,
} from "@/lib/types/sell-catalog-search"
import {
  sellCatalogHandoffFromRow,
  writeSellCatalogHandoff,
} from "@/lib/sell-flow/catalog-handoff"
import { brandLogoDisplaySrc } from "@/lib/public-media-display-src"
import { finCatalogSearchRowThumbUrl } from "@/lib/utils/fin-catalog-display-image"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { finSetupLabel, finSizeLabel, finSystemLabel } from "@/lib/fin-listing-config"
import { compactSearchKey } from "@/lib/utils/fin-catalog-search-rank"
import { cn } from "@/lib/utils"

const SEARCH_DEBOUNCE_MS = 250

const SUGGEST_DROPDOWN_PANEL_CLASS =
  "flex min-h-0 flex-col overflow-hidden border bg-popover text-popover-foreground touch-pan-y pointer-events-auto fixed z-[160] max-sm:rounded-xl rounded-2xl border-border/80 shadow-xl shadow-black/10 max-sm:shadow-2xl"

export type SellCatalogSearchProps = {
  /** "List manually without searching" — reveals the product-type chooser. */
  onSkip: () => void
  className?: string
}

function thumbForRow(row: SellCatalogSearchResultRow): string | null {
  if (row.kind === "brand") {
    return finCatalogSearchRowThumbUrl({ kind: "brand", logoUrl: row.logoUrl })
  }
  if (row.kind === "model") {
    return finCatalogSearchRowThumbUrl({
      kind: "model",
      imageUrl: row.imageUrl,
      brandLogoUrl: row.brandLogoUrl,
    })
  }
  return finCatalogSearchRowThumbUrl({
    kind: "variant",
    imageUrl: row.imageUrl,
    modelImageUrl: row.modelImageUrl,
    brandLogoUrl: row.brandLogoUrl,
  })
}

function productTitleLine(row: SellCatalogSearchResultRow): string {
  if (row.kind === "brand") return row.name
  if (row.kind === "model") return row.name
  return row.modelName
}

function productMetaLine(row: SellCatalogSearchResultRow): string | null {
  if (row.kind === "variant") {
    const parts = [
      row.brandName,
      finSystemLabel(row.finSystem),
      finSetupLabel(row.finSetup),
      finSizeLabel(row.finSize),
    ].filter((part): part is string => Boolean(part?.trim()))
    if (parts.length > 0) return parts.join(" · ")
    return row.variantLabel.trim() || row.brandName
  }
  if (row.kind === "model") {
    return `${row.brandName} · ${sellCatalogSearchCategoryLabel(row.category)}`
  }
  const desc = row.shortDescription?.trim()
  const category = sellCatalogSearchCategoryLabel(row.category)
  if (!desc) return category
  return `${desc.length > 48 ? `${desc.slice(0, 45).trimEnd()}…` : desc} · ${category}`
}

function rowKey(row: SellCatalogSearchResultRow): string {
  return `${row.kind}-${row.id}`
}

function partitionDropdownRows(rows: SellCatalogSearchResultRow[]): {
  suggestions: SellCatalogSearchResultRow[]
  products: SellCatalogSearchResultRow[]
} {
  const suggestions: SellCatalogSearchResultRow[] = []
  const products: SellCatalogSearchResultRow[] = []
  for (const row of rows) {
    if (row.kind === "variant") {
      products.push(row)
      continue
    }
    if (row.kind === "model" && thumbForRow(row)) {
      products.push(row)
      continue
    }
    suggestions.push(row)
  }
  return { suggestions, products }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function highlightQueryParts(text: string, query: string): React.ReactNode {
  const q = query.trim()
  if (!q || !text) return text

  const tokens = Array.from(
    new Set(
      (q.toLowerCase().match(/[\w']+/g) ?? [])
        .map((t) => t.replace(/^'+|'+$/g, ""))
        .filter((t) => t.length >= 2),
    ),
  ).sort((a, b) => b.length - a.length)

  if (tokens.length === 0) {
    const compactQ = compactSearchKey(q)
    const compactText = compactSearchKey(text)
    if (compactQ.length >= 2 && compactText.includes(compactQ)) {
      return <span className="font-semibold text-foreground">{text}</span>
    }
    return text
  }

  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "ig")
  const parts = text.split(pattern)
  return parts.map((part, index) => {
    const isMatch = tokens.some((token) => part.toLowerCase() === token)
    if (isMatch) {
      return (
        <span key={`${part}-${index}`} className="font-semibold text-foreground">
          {part}
        </span>
      )
    }
    return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
  })
}

function SuggestionRow({
  row,
  query,
  onSelect,
}: {
  row: SellCatalogSearchResultRow
  query: string
  onSelect: (row: SellCatalogSearchResultRow) => void
}) {
  const brand = sellCatalogSearchRowBrandName(row)
  const model = sellCatalogSearchRowModelName(row)

  return (
    <li role="option">
      <button
        type="button"
        className="mx-1 flex w-[calc(100%-0.5rem)] cursor-pointer select-none flex-wrap items-baseline gap-x-1.5 gap-y-0.5 rounded-lg px-3 py-2.5 text-left text-sm outline-none transition-colors hover:bg-muted/80 focus-visible:bg-muted/80 min-h-touch"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onSelect(row)}
      >
        <span className="font-semibold text-foreground">
          {highlightQueryParts(brand, query)}
        </span>
        {model ? (
          <span className="text-foreground/85">
            {highlightQueryParts(model, query)}
          </span>
        ) : null}
      </button>
    </li>
  )
}

function CatalogThumb({
  src,
  alt,
  fallbackLetter,
  isLogo,
}: {
  src: string | null | undefined
  alt: string
  fallbackLetter: string
  isLogo: boolean
}) {
  const displaySrc = src?.trim() ? brandLogoDisplaySrc(src) : null
  return (
    <div className={navSearchTopListingThumbClassName}>
      {displaySrc ? (
        <Image
          src={displaySrc}
          alt={alt}
          fill
          className={cn(isLogo ? "object-contain p-1.5" : "object-cover")}
          sizes="(max-width:640px) 48px, 56px"
          unoptimized={listingImageShouldBypassOptimization(displaySrc)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-cerulean sm:text-base">
          {fallbackLetter.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  )
}

function ProductRow({
  row,
  query,
  onSelect,
}: {
  row: SellCatalogSearchResultRow
  query: string
  onSelect: (row: SellCatalogSearchResultRow) => void
}) {
  const title = productTitleLine(row)
  const meta = productMetaLine(row)
  const thumb = thumbForRow(row)
  const brandLogo =
    row.kind === "brand" ? row.logoUrl?.trim() : row.brandLogoUrl?.trim()
  const isLogo = row.kind === "brand" || Boolean(brandLogo && thumb === brandLogo)

  return (
    <li role="option">
      <button
        type="button"
        className={navSearchTopListingRowClassName}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onSelect(row)}
      >
        <CatalogThumb
          src={thumb}
          alt={title}
          fallbackLetter={title}
          isLogo={isLogo}
        />
        <div className="min-w-0 flex-1 pt-0.5 sm:pt-0">
          <p className={navSearchTopListingTitleClassName}>
            {highlightQueryParts(title, query)}
          </p>
          {meta ? (
            <p className={navSearchTopListingMetaClassName}>
              {highlightQueryParts(meta, query)}
            </p>
          ) : null}
        </div>
      </button>
    </li>
  )
}

function DropdownResults({
  rows,
  query,
  onSelect,
}: {
  rows: SellCatalogSearchResultRow[]
  query: string
  onSelect: (row: SellCatalogSearchResultRow) => void
}) {
  const { suggestions, products } = partitionDropdownRows(rows)
  if (suggestions.length === 0 && products.length === 0) return null

  return (
    <>
      {suggestions.length > 0 ? (
        <div className={cn(products.length > 0 && "border-b border-border/60")}>
          <NavSearchTopListingSectionHeader title="Suggestions" />
          <ul className="min-h-0 max-h-[min(34dvh,220px)] overflow-y-auto overscroll-contain py-1 sm:max-h-[min(36dvh,240px)]">
            {suggestions.map((row) => (
              <SuggestionRow key={rowKey(row)} row={row} query={query} onSelect={onSelect} />
            ))}
          </ul>
        </div>
      ) : null}

      {products.length > 0 ? (
        <div>
          <NavSearchTopListingSectionHeader title="Catalog matches" />
          <ul className="min-h-0 max-h-[min(42dvh,280px)] overflow-y-auto overscroll-contain py-1 sm:max-h-[min(45dvh,360px)]">
            {products.map((row) => (
              <ProductRow key={rowKey(row)} row={row} query={query} onSelect={onSelect} />
            ))}
          </ul>
        </div>
      ) : null}
    </>
  )
}

export function SellCatalogSearch({ onSkip, className }: SellCatalogSearchProps) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [searchSettled, setSearchSettled] = React.useState(false)
  const [results, setResults] = React.useState<SellCatalogSearchResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [hasSearched, setHasSearched] = React.useState(false)
  const [panelOpen, setPanelOpen] = React.useState(false)
  const [dropdownRect, setDropdownRect] = React.useState<{
    dropTop: number
    anchorLeft: number
    anchorWidth: number
  } | null>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchEpochRef = React.useRef(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const formRef = React.useRef<HTMLFormElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  const dismissSearchFocus = React.useCallback(() => {
    setPanelOpen(false)
    inputRef.current?.blur()
  }, [])

  React.useEffect(() => {
    if (!panelOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      dismissSearchFocus()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [dismissSearchFocus, panelOpen])

  const runSearch = React.useCallback(async (q: string, epoch: number) => {
    setLoading(true)
    setSearchSettled(false)
    setError(null)
    try {
      const res = await fetch(
        `/api/sell/catalog-search?${new URLSearchParams({ q })}`,
        { method: "GET", headers: { Accept: "application/json" } },
      )
      if (epoch !== searchEpochRef.current) return

      const body = (await res.json()) as { data?: SellCatalogSearchResult; error?: string }
      if (!res.ok || !body.data) {
        setResults(null)
        setError(body.error ?? "Could not search the catalog. Please try again.")
        setSearchSettled(true)
        return
      }
      setResults(body.data)
      setSearchSettled(true)
    } catch {
      if (epoch !== searchEpochRef.current) return
      setResults(null)
      setError("Could not search the catalog. Please try again.")
      setSearchSettled(true)
    } finally {
      if (epoch === searchEpochRef.current) {
        setLoading(false)
      }
    }
  }, [])

  const queueSearch = React.useCallback(
    (q: string) => {
      const trimmed = q.trim()
      if (trimmed.length < 1) {
        searchEpochRef.current += 1
        setLoading(false)
        setSearchSettled(false)
        setResults(null)
        setError(null)
        setHasSearched(false)
        setPanelOpen(false)
        return
      }

      setHasSearched(true)
      setPanelOpen(true)
      searchEpochRef.current += 1
      const epoch = searchEpochRef.current
      setLoading(true)
      setResults(null)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        void runSearch(trimmed, epoch)
      }, SEARCH_DEBOUNCE_MS)
    },
    [runSearch],
  )

  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed.length < 1) {
      inputRef.current?.focus()
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    searchEpochRef.current += 1
    const epoch = searchEpochRef.current
    setHasSearched(true)
    setPanelOpen(true)
    void runSearch(trimmed, epoch)
  }

  const handleSelect = React.useCallback(
    (row: SellCatalogSearchResultRow) => {
      writeSellCatalogHandoff(sellCatalogHandoffFromRow(row))
      router.push(sellCatalogSearchCategorySellPath(sellCatalogSearchRowCategory(row)))
    },
    [router],
  )

  const matchTier = results?.meta.matchTier ?? "none"
  const rankedRows =
    matchTier === "similar" ? (results?.similarResults ?? []) : (results?.results ?? [])
  const hasResults = rankedRows.length > 0
  const trimmedQuery = query.trim()
  const showResultsPanel = panelOpen && hasSearched && trimmedQuery.length >= 1
  const showNoMatches =
    showResultsPanel && searchSettled && !loading && !hasResults && !error
  const showSimilarFallback = matchTier === "similar" && hasResults

  React.useEffect(() => {
    if (!showResultsPanel || !formRef.current) {
      setDropdownRect(null)
      return
    }
    const form = formRef.current
    const update = () => {
      const rect = form.getBoundingClientRect()
      setDropdownRect({
        dropTop: rect.bottom + 8,
        anchorLeft: rect.left,
        anchorWidth: rect.width,
      })
    }
    update()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener("resize", update)
      vv.addEventListener("scroll", update)
    }
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
      if (vv) {
        vv.removeEventListener("resize", update)
        vv.removeEventListener("scroll", update)
      }
    }
  }, [showResultsPanel, rankedRows.length, loading, error])

  React.useEffect(() => {
    if (!showResultsPanel) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (formRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      dismissSearchFocus()
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showResultsPanel, dismissSearchFocus])

  const panelLayout =
    dropdownRect && typeof window !== "undefined"
      ? getSuggestPanelLayout({
          top: dropdownRect.dropTop,
          anchorLeft: dropdownRect.anchorLeft,
          anchorWidth: dropdownRect.anchorWidth,
          portalRect: null,
          matchAnchorWidth: true,
        })
      : null

  const dropdownPanel =
    showResultsPanel &&
    dropdownRect &&
    panelLayout &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={dropdownRef}
        id="sell-catalog-search-listbox"
        role="listbox"
        className={SUGGEST_DROPDOWN_PANEL_CLASS}
        style={{
          top: dropdownRect.dropTop,
          left: panelLayout.left,
          width: panelLayout.width,
          maxHeight: panelLayout.maxHeight,
        }}
        aria-live="polite"
        aria-busy={loading && !hasResults}
        onMouseDown={(event) => {
          event.preventDefault()
        }}
      >
        {loading && !hasResults ? (
          <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground sm:py-10">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Searching catalog…
          </div>
        ) : null}

        {error ? (
          <div className="px-4 py-4 text-sm text-destructive sm:px-5 sm:py-5">{error}</div>
        ) : null}

        {showSimilarFallback ? (
          <div className="border-b border-border/60 px-4 py-2.5 text-sm sm:px-4 sm:py-3">
            <p className="text-muted-foreground">
              No exact match for &ldquo;{trimmedQuery}&rdquo;. Closest catalog results:
            </p>
          </div>
        ) : null}

        {showNoMatches ? (
          <div className="space-y-3 px-4 py-5 text-sm sm:px-4">
            <p className="text-muted-foreground">
              No catalog matches for that search. You can still list your item manually —
              brand and model don&apos;t have to be in our directory.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="w-full min-h-touch md:w-auto"
              onClick={onSkip}
            >
              Choose a category manually
            </Button>
          </div>
        ) : null}

        {hasResults ? (
          <>
            <DropdownResults rows={rankedRows} query={trimmedQuery} onSelect={handleSelect} />
            {showSimilarFallback ? (
              <div className="border-t border-border/60 px-4 py-3 sm:px-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full min-h-touch md:w-auto"
                  onClick={onSkip}
                >
                  Continue without a catalog match
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>,
      document.body,
    )

  return (
    <main className={cn("relative flex-1 bg-background pb-12 pt-8 sm:pt-12 sm:pb-16 md:pb-24", className)}>
      <div className="container relative mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mx-auto w-full max-w-xl space-y-8 sm:space-y-10">
          <header className="space-y-2 text-center sm:space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              What are you listing?
            </h1>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              Search our catalog by brand or model — pick the closest match and we&apos;ll
              start your listing in the right category.
            </p>
          </header>

          <div className="relative w-full min-w-0">
            <SiteSearchBar ref={formRef} onSubmit={handleSubmit} className="w-full shadow-surface">
              <input
                id="sell-catalog-search-input"
                ref={inputRef}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  queueSearch(e.target.value)
                }}
                onFocus={() => {
                  if (query.trim().length >= 1) setPanelOpen(true)
                }}
                placeholder="Search brand or model"
                className={cn(
                  siteSearchInputClassName(),
                  trimmedQuery.length > 0 ? "pr-10" : undefined,
                  "[&::-webkit-search-cancel-button]:hidden [&::-moz-search-clear]:hidden",
                )}
                autoComplete="off"
                aria-label="Search brand or model"
                aria-expanded={showResultsPanel}
                aria-haspopup="listbox"
                aria-controls={showResultsPanel ? "sell-catalog-search-listbox" : undefined}
              />
              {trimmedQuery.length > 0 ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuery("")
                    queueSearch("")
                    inputRef.current?.focus()
                  }}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </SiteSearchBar>

            {!showResultsPanel ? (
              <p className="mt-2 text-center text-xs text-muted-foreground/70">
                Surfboards, fins, and wetsuits from our brand catalog
              </p>
            ) : null}

            {dropdownPanel}
          </div>

          <div className="text-center">
            <Button
              type="button"
              variant="ghost"
              className="h-auto px-4 py-2 text-sm text-muted-foreground"
              onClick={onSkip}
            >
              List manually without searching
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
