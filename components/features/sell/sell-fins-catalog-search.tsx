"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Loader2, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  SiteSearchFormSubmitButton,
  SiteSearchShell,
  siteSearchInputClassName,
} from "@/components/site-search-bar"
import {
  finCatalogSelectionFromRow,
  type FinCatalogSearchBrandRow,
  type FinCatalogSearchModelRow,
  type FinCatalogSearchResult,
  type FinCatalogSearchSelection,
  type FinCatalogSearchVariantRow,
} from "@/lib/types/fin-catalog-search"
import { brandLogoDisplaySrc } from "@/lib/public-media-display-src"
import { finCatalogSearchRowThumbUrl } from "@/lib/utils/fin-catalog-display-image"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { finSetupLabel, finSizeLabel, finSystemLabel } from "@/lib/fin-listing-config"
import { compactSearchKey } from "@/lib/utils/fin-catalog-search-rank"
import { SellFocusScrim } from "@/components/features/sell/sell-focus-scrim"
import { cn } from "@/lib/utils"

const SEARCH_DEBOUNCE_MS = 250

type CatalogResultRow =
  | FinCatalogSearchBrandRow
  | FinCatalogSearchModelRow
  | FinCatalogSearchVariantRow

export type SellFinsCatalogSearchProps = {
  onSelect: (selection: FinCatalogSearchSelection) => void
  onSkip: () => void
  onExit?: () => void
  className?: string
}

function thumbForRow(row: CatalogResultRow): string | null {
  return finCatalogSearchRowThumbUrl(row)
}

function titleForRow(row: CatalogResultRow): string {
  if (row.kind === "brand") return row.name
  if (row.kind === "model") return `${row.brandName} ${row.name}`
  return `${row.brandName} ${row.modelName}`
}

function brandNameForRow(row: CatalogResultRow): string {
  return row.kind === "brand" ? row.name : row.brandName
}

function modelNameForRow(row: CatalogResultRow): string | null {
  if (row.kind === "brand") return null
  if (row.kind === "model") return row.name
  return row.modelName
}

function productMetaLine(row: CatalogResultRow): string | null {
  if (row.kind === "variant") {
    const parts = [
      finSystemLabel(row.finSystem),
      finSetupLabel(row.finSetup),
      finSizeLabel(row.finSize),
    ].filter((part): part is string => Boolean(part?.trim()))
    if (parts.length > 0) return parts.join(" · ")
    return row.variantLabel.trim() || null
  }
  if (row.kind === "model") {
    return row.description?.trim() || null
  }
  return row.shortDescription?.trim() || null
}

function rowKey(row: CatalogResultRow): string {
  return `${row.kind}-${row.id}`
}

/** Brands/models as text suggestions; variants (and imaged models) as product rows. */
function partitionDropdownRows(rows: CatalogResultRow[]): {
  suggestions: CatalogResultRow[]
  products: CatalogResultRow[]
} {
  const suggestions: CatalogResultRow[] = []
  const products: CatalogResultRow[] = []
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function SuggestionRow({
  row,
  query,
  onSelect,
}: {
  row: CatalogResultRow
  query: string
  onSelect: (selection: FinCatalogSearchSelection) => void
}) {
  const brand = brandNameForRow(row)
  const model = modelNameForRow(row)

  return (
    <li>
      <button
        type="button"
        className="flex w-full cursor-pointer select-none flex-wrap items-baseline gap-x-1.5 gap-y-0.5 px-3.5 py-2.5 text-left text-[15px] leading-snug outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 sm:px-4 sm:text-sm"
        onClick={() => onSelect(finCatalogSelectionFromRow(row))}
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

function ProductThumb({
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
    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border/70 bg-muted/30 sm:h-11 sm:w-11 sm:rounded-md">
      {displaySrc ? (
        <Image
          src={displaySrc}
          alt={alt}
          fill
          className={cn(isLogo ? "object-contain p-1.5" : "object-cover")}
          sizes="44px"
          unoptimized={listingImageShouldBypassOptimization(displaySrc)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted/50 text-sm font-semibold text-cerulean/80">
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
  row: CatalogResultRow
  query: string
  onSelect: (selection: FinCatalogSearchSelection) => void
}) {
  const title = titleForRow(row)
  const meta = productMetaLine(row)
  const thumb = thumbForRow(row)
  const brandLogo =
    row.kind === "brand" ? row.logoUrl?.trim() : row.brandLogoUrl?.trim()
  const isLogo = row.kind === "brand" || Boolean(brandLogo && thumb === brandLogo)

  return (
    <li>
      <button
        type="button"
        className="flex w-full cursor-pointer select-none items-start gap-3 px-3.5 py-2.5 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 sm:items-center sm:px-4"
        onClick={() => onSelect(finCatalogSelectionFromRow(row))}
      >
        <ProductThumb
          src={thumb}
          alt={title}
          fallbackLetter={title}
          isLogo={isLogo}
        />
        <div className="min-w-0 flex-1 pt-0.5 sm:pt-0">
          <p className="line-clamp-2 text-[15px] leading-snug text-foreground/90 sm:text-sm">
            {highlightQueryParts(title, query)}
          </p>
          {meta ? (
            <p className="mt-0.5 line-clamp-1 text-xs leading-snug text-muted-foreground">
              {meta}
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
  rows: CatalogResultRow[]
  query: string
  onSelect: (selection: FinCatalogSearchSelection) => void
}) {
  const { suggestions, products } = partitionDropdownRows(rows)
  if (suggestions.length === 0 && products.length === 0) return null

  return (
    <div className="max-h-[min(52dvh,440px)] overflow-y-auto overscroll-contain sm:max-h-[min(65dvh,560px)] [-ms-overflow-style:none] [scrollbar-width:thin]">
      {suggestions.length > 0 ? (
        <div className={cn(products.length > 0 && "border-b border-border/50")}>
          <p className="px-3.5 pt-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80 sm:px-4">
            Suggestions
          </p>
          <ul>
            {suggestions.map((row) => (
              <SuggestionRow key={rowKey(row)} row={row} query={query} onSelect={onSelect} />
            ))}
          </ul>
        </div>
      ) : null}

      {products.length > 0 ? (
        <div>
          {suggestions.length > 0 ? (
            <p className="px-3.5 pt-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80 sm:px-4">
              Catalog
            </p>
          ) : null}
          <ul className="divide-y divide-border/40">
            {products.map((row) => (
              <ProductRow key={rowKey(row)} row={row} query={query} onSelect={onSelect} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export function SellFinsCatalogSearch({ onSelect, onSkip, onExit, className }: SellFinsCatalogSearchProps) {
  const [query, setQuery] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [searchSettled, setSearchSettled] = React.useState(false)
  const [results, setResults] = React.useState<FinCatalogSearchResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [hasSearched, setHasSearched] = React.useState(false)
  const [focusMode, setFocusMode] = React.useState(false)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchEpochRef = React.useRef(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const focusStageRef = React.useRef<HTMLDivElement>(null)

  const dismissSearchFocus = React.useCallback(() => {
    const active = document.activeElement
    if (active instanceof HTMLElement && focusStageRef.current?.contains(active)) {
      active.blur()
    }
    inputRef.current?.blur()
    setFocusMode(false)
  }, [])

  React.useEffect(() => {
    if (!focusMode) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      dismissSearchFocus()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [dismissSearchFocus, focusMode])

  const runSearch = React.useCallback(async (q: string, epoch: number) => {
    setLoading(true)
    setSearchSettled(false)
    setError(null)
    try {
      const res = await fetch(
        `/api/sell/fins/catalog-search?${new URLSearchParams({ q })}`,
        { method: "GET", headers: { Accept: "application/json" } },
      )
      if (epoch !== searchEpochRef.current) return

      const body = (await res.json()) as { data?: FinCatalogSearchResult; error?: string }
      if (!res.ok) {
        setResults(null)
        setError(body.error ?? "Could not search the fin catalog. Please try again.")
        setSearchSettled(true)
        return
      }
      if (!body.data) {
        setResults(null)
        setError("Could not search the fin catalog. Please try again.")
        setSearchSettled(true)
        return
      }
      setResults(body.data)
      setSearchSettled(true)
    } catch {
      if (epoch !== searchEpochRef.current) return
      setResults(null)
      setError("Could not search the fin catalog. Please try again.")
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
        return
      }

      setHasSearched(true)
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
    void runSearch(trimmed, epoch)
  }

  const matchTier = results?.meta.matchTier ?? "none"
  const rankedRows =
    matchTier === "similar"
      ? (results?.similarResults ?? [])
      : (results?.results ?? [])
  const hasResults = rankedRows.length > 0

  const showResultsPanel = hasSearched && query.trim().length >= 1
  const showNoMatches =
    showResultsPanel && searchSettled && !loading && !hasResults && !error
  const showSimilarFallback = matchTier === "similar" && hasResults
  const trimmedQuery = query.trim()

  return (
    <main
      className={cn(
        "relative flex-1 w-full bg-slate-100 pb-12 pt-5 sm:pt-8 sm:pb-16 md:pb-24",
        className,
      )}
    >
      <SellFocusScrim open={focusMode} onDismiss={dismissSearchFocus} />

      <div className="container relative mx-auto max-w-6xl px-3 sm:px-6">
        <div
          className={cn(
            "mb-5 border-t border-neutral-200 pt-3 transition-opacity duration-200 motion-reduce:transition-none sm:mb-8 sm:pt-4",
            focusMode && "pointer-events-none opacity-35",
          )}
          aria-hidden={focusMode || undefined}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <Breadcrumb>
              <BreadcrumbList className="gap-1.5 text-sm font-normal text-[#5c6b89] sm:gap-2">
                <BreadcrumbItem>
                  <BreadcrumbLink asChild className="text-[#5c6b89] hover:text-[#4a5768]">
                    <Link href="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild className="text-[#5c6b89] hover:text-[#4a5768]">
                    <Link href="/sell">Sell</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-normal text-[#5c6b89]">Catalog search</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Button type="button" variant="ghost" size="icon" aria-label="Exit listing flow" asChild>
              <Link href="/sell" onClick={onExit}>
                <X className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>

        <div
          ref={focusStageRef}
          className={cn(focusMode && "relative z-50")}
          onFocusCapture={() => setFocusMode(true)}
          onBlurCapture={(event) => {
            const next = event.relatedTarget
            if (next instanceof Node && focusStageRef.current?.contains(next)) return
            setFocusMode(false)
          }}
        >
          <div className="mx-auto w-full max-w-2xl space-y-5 sm:space-y-8">
            <header
              className={cn(
                "space-y-1.5 text-left sm:space-y-2",
                focusMode && "max-sm:hidden",
              )}
            >
              <h1 className="text-[1.65rem] font-semibold tracking-tight text-foreground sm:text-3xl">
                Find a match
              </h1>
              <p
                className={cn(
                  "text-sm leading-relaxed text-muted-foreground transition-opacity duration-200 motion-reduce:transition-none sm:text-base",
                  focusMode && "opacity-40",
                )}
              >
                Search our fin catalog by brand, model, setup, or system — then pick the closest
                match to prefill your listing.
              </p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="w-full min-w-0">
                <label
                  htmlFor="sell-fins-catalog-search-input"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Brand, model, or system
                </label>
                <SiteSearchShell
                  className={cn(
                    "relative z-[1] h-12 min-h-12 gap-1.5 pl-2.5 pr-1 sm:h-auto sm:min-h-0 sm:gap-1 sm:pl-3 sm:pr-1.5",
                    "focus-within:border-cerulean/50 focus-within:ring-2 focus-within:ring-cerulean/25 focus-within:shadow-sm",
                    focusMode && "border-cerulean/45 bg-background shadow-md ring-2 ring-cerulean/20",
                    showResultsPanel &&
                      "rounded-t-2xl rounded-b-none border-b-transparent shadow-none ring-0 focus-within:shadow-none focus-within:ring-0 sm:rounded-t-full",
                    showResultsPanel &&
                      focusMode &&
                      "border-cerulean/45 ring-2 ring-cerulean/20",
                  )}
                  actionSlot={
                    <SiteSearchFormSubmitButton
                      type="submit"
                      compact
                      disabled={loading && trimmedQuery.length >= 1}
                      className="h-9 min-h-9 px-3.5 text-[13px] sm:h-10 sm:min-h-10 sm:px-5 sm:text-[14px]"
                    >
                      Search
                    </SiteSearchFormSubmitButton>
                  }
                >
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 sm:left-3 sm:h-5 sm:w-5"
                    aria-hidden
                  />
                  <input
                    id="sell-fins-catalog-search-input"
                    ref={inputRef}
                    type="text"
                    inputMode="search"
                    enterKeyHint="search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      queueSearch(e.target.value)
                    }}
                    placeholder="Brand, model, or system"
                    className={cn(
                      siteSearchInputClassName({ compact: true }),
                      "h-full min-h-0 pl-9 text-[16px] leading-none outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 sm:pl-10 sm:text-[15px]",
                      trimmedQuery.length > 0 ? "pr-9" : "pr-1.5",
                    )}
                    autoComplete="off"
                    aria-label="Brand, model, or system"
                  />
                  {trimmedQuery.length > 0 ? (
                    <button
                      type="button"
                      aria-label="Clear search"
                      className="absolute right-0.5 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted/80 hover:text-foreground"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setQuery("")
                        queueSearch("")
                        inputRef.current?.focus()
                      }}
                    >
                      <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                    </button>
                  ) : null}
                </SiteSearchShell>

                {showResultsPanel ? (
                  <section
                    className={cn(
                      "-mt-px w-full min-w-0 overflow-hidden rounded-b-2xl border border-border bg-card text-card-foreground shadow-md sm:rounded-b-xl",
                      "rounded-t-none border-t-border/60",
                      focusMode && "border-cerulean/35",
                    )}
                    aria-live="polite"
                    onMouseDown={(event) => {
                      // Keep focus inside the stage when choosing a result so the scrim
                      // does not flicker off between mousedown and click.
                      event.preventDefault()
                    }}
                  >
                    {loading && !hasResults ? (
                      <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground sm:py-10">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Searching fin catalog…
                      </div>
                    ) : null}

                    {error ? (
                      <div className="px-3.5 py-4 text-sm text-destructive sm:px-5 sm:py-5">{error}</div>
                    ) : null}

                    {showSimilarFallback ? (
                      <div className="border-b border-border/40 px-3.5 py-2.5 text-sm sm:px-4 sm:py-3">
                        <p className="text-muted-foreground">
                          No exact match for &ldquo;{trimmedQuery}&rdquo;. Closest catalog results:
                        </p>
                      </div>
                    ) : null}

                    {showNoMatches ? (
                      <div className="space-y-3 px-3.5 py-5 text-sm sm:px-4">
                        <p className="text-muted-foreground">
                          No fin catalog matches for that search. You can still list your fins
                          manually — brand and model don&apos;t have to be in our directory.
                        </p>
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

                    {hasResults ? (
                      <>
                        <DropdownResults
                          rows={rankedRows}
                          query={trimmedQuery}
                          onSelect={onSelect}
                        />
                        {showSimilarFallback ? (
                          <div className="border-t border-border/40 px-3.5 py-3 sm:px-4">
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
                  </section>
                ) : null}
              </div>

              {!showResultsPanel ? (
                <p
                  className={cn(
                    "text-xs text-muted-foreground/60 transition-opacity duration-200 motion-reduce:transition-none",
                    focusMode && "opacity-40",
                  )}
                >
                  Only fin brands and models from our catalog are shown (brands tagged as fin
                  manufacturers).
                </p>
              ) : null}
            </form>
          </div>
        </div>

        <div
          className={cn(
            "relative z-50 mx-auto mt-5 max-w-2xl transition-opacity duration-200 motion-reduce:transition-none sm:mt-8",
            focusMode && "opacity-70",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            className="h-auto px-1 py-2 text-sm text-muted-foreground sm:px-4"
            onClick={onSkip}
          >
            List manually without searching
          </Button>
        </div>
      </div>
    </main>
  )
}
