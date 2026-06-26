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
import { searchFinCatalogForSellAction } from "@/lib/actions/finListingActions"
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
import { cn } from "@/lib/utils"

const SEARCH_DEBOUNCE_MS = 250

type CatalogResultRow =
  | FinCatalogSearchBrandRow
  | FinCatalogSearchModelRow
  | FinCatalogSearchVariantRow

type CatalogMetaLine = { label: string; value: string }

export type SellFinsCatalogSearchProps = {
  onSelect: (selection: FinCatalogSearchSelection) => void
  onSkip: () => void
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

function metaLinesForRow(row: CatalogResultRow): CatalogMetaLine[] {
  if (row.kind === "brand") return []
  if (row.kind === "model") {
    return [
      { label: "Brand", value: row.brandName },
      { label: "Model", value: row.name },
    ]
  }
  return [
    { label: "Brand", value: row.brandName },
    { label: "Model", value: row.modelName },
  ]
}

function rowKey(row: CatalogResultRow): string {
  return `${row.kind}-${row.id}`
}

function partitionResults(data: FinCatalogSearchResult): {
  topPick: CatalogResultRow | null
  moreMatches: CatalogResultRow[]
} {
  const ordered = data.results.length > 0 ? data.results : [...data.variants, ...data.models, ...data.brands]
  if (ordered.length === 0) return { topPick: null, moreMatches: [] }
  return { topPick: ordered[0] ?? null, moreMatches: ordered.slice(1) }
}

function ResultImage({
  src,
  alt,
  fallbackLetter,
  isLogo,
  emphasized,
}: {
  src: string | null | undefined
  alt: string
  fallbackLetter: string
  isLogo: boolean
  emphasized?: boolean
}) {
  const displaySrc = src?.trim() ? brandLogoDisplaySrc(src) : null
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xl border border-border/70 bg-muted/30",
        emphasized
          ? "h-[7.5rem] w-[7.5rem] sm:h-36 sm:w-36 lg:h-44 lg:w-44"
          : "h-[7.5rem] w-[7.5rem] sm:h-32 sm:w-32 lg:h-36 lg:w-36",
      )}
    >
      {displaySrc ? (
        <Image
          src={displaySrc}
          alt={alt}
          fill
          className={cn(isLogo ? "object-contain p-3 lg:p-4" : "object-cover")}
          sizes="(max-width: 640px) 120px, (max-width: 1024px) 144px, 176px"
          unoptimized={listingImageShouldBypassOptimization(displaySrc)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted/50 text-2xl font-semibold text-cerulean/80 sm:text-3xl lg:text-4xl">
          {fallbackLetter.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  )
}

function CatalogMatchRow({
  row,
  onSelect,
  emphasized,
}: {
  row: CatalogResultRow
  onSelect: (selection: FinCatalogSearchSelection) => void
  emphasized?: boolean
}) {
  const title = titleForRow(row)
  const meta = metaLinesForRow(row)
  const thumb = thumbForRow(row)
  const brandLogo =
    row.kind === "brand" ? row.logoUrl?.trim() : row.brandLogoUrl?.trim()
  const isLogo = row.kind === "brand" || Boolean(brandLogo && thumb === brandLogo)

  return (
    <li>
      <button
        type="button"
        className={cn(
          "flex w-full cursor-pointer select-none gap-4 px-4 py-4 text-left outline-none transition-colors sm:gap-6 sm:px-6 sm:py-6 lg:gap-8 lg:px-8 lg:py-7",
          "hover:bg-muted/35 focus-visible:bg-muted/35",
          emphasized && "bg-muted/15",
        )}
        onClick={() => onSelect(finCatalogSelectionFromRow(row))}
      >
        <ResultImage
          src={thumb}
          alt={title}
          fallbackLetter={title}
          isLogo={isLogo}
          emphasized={emphasized}
        />
        <div className="min-w-0 flex-1 pt-0.5 lg:pt-1">
          <p
            className={cn(
              "line-clamp-2 leading-snug text-foreground",
              emphasized
                ? "text-base font-semibold sm:text-lg lg:text-xl"
                : "text-sm font-semibold sm:text-base lg:text-lg",
            )}
          >
            {title}
          </p>
          {meta.length > 0 ? (
            <dl className="mt-2 space-y-1 lg:mt-3 lg:space-y-1.5">
              {meta.map((line) => (
                <div key={line.label} className="flex flex-wrap gap-x-1.5 text-xs sm:text-sm lg:text-base">
                  <dt className="shrink-0 text-muted-foreground">{line.label}:</dt>
                  <dd className="min-w-0 text-foreground/90">{line.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </button>
    </li>
  )
}

function ResultsSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-border/60 last:border-b-0 md:border-b-0">
      <h2 className="border-b border-border/40 bg-muted/20 px-4 py-2.5 text-xs font-semibold tracking-wide text-foreground sm:px-6 sm:text-sm md:bg-transparent md:px-8 md:py-3 md:text-base lg:px-10">
        {title}
      </h2>
      <ul className="md:divide-y md:divide-border/50">{children}</ul>
    </div>
  )
}

export function SellFinsCatalogSearch({ onSelect, onSkip, className }: SellFinsCatalogSearchProps) {
  const [query, setQuery] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [searchSettled, setSearchSettled] = React.useState(false)
  const [results, setResults] = React.useState<FinCatalogSearchResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [hasSearched, setHasSearched] = React.useState(false)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchEpochRef = React.useRef(0)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const runSearch = React.useCallback(async (q: string, epoch: number) => {
    setLoading(true)
    setSearchSettled(false)
    setError(null)
    try {
      const res = await searchFinCatalogForSellAction(q)
      if (epoch !== searchEpochRef.current) return
      if (!res.ok) {
        setResults(null)
        setError(res.error)
        setSearchSettled(true)
        return
      }
      setResults(res.data)
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

  const { topPick, moreMatches } = results
    ? partitionResults(results)
    : { topPick: null, moreMatches: [] }
  const hasResults = topPick != null

  const showResultsPanel = hasSearched && query.trim().length >= 1
  const showNoMatches =
    showResultsPanel && searchSettled && !loading && !hasResults && !error

  return (
    <main className={cn("flex-1 w-full bg-background pt-8 pb-16 md:pb-24", className)}>
      <div className="container relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-8 border-t border-neutral-200 pt-4">
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
                  <BreadcrumbPage className="font-normal text-[#5c6b89]">List fins</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Button type="button" variant="ghost" size="icon" aria-label="Exit listing flow" asChild>
              <Link href="/sell">
                <X className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto max-w-2xl space-y-8">
          <header className="space-y-2 text-center sm:text-left">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Find a match
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              Search our fin catalog by brand, model, setup, or system — then pick the closest
              match to prefill your listing.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-4">
            <SiteSearchShell
              className={cn(
                "pl-3",
                "focus-within:border-border focus-within:ring-1 focus-within:ring-foreground/5 focus-within:shadow-sm",
              )}
              actionSlot={
                <SiteSearchFormSubmitButton type="submit" disabled={loading && query.trim().length >= 1}>
                  Search
                </SiteSearchFormSubmitButton>
              }
            >
              <Search
                className="pointer-events-none absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-muted-foreground/60"
                aria-hidden
              />
              <input
                ref={inputRef}
                type="text"
                inputMode="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  queueSearch(e.target.value)
                }}
                placeholder="Enter brand, model, fin setup, system, etc."
                className={cn(
                  siteSearchInputClassName(),
                  "pl-10 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0",
                  query.trim().length > 0 ? "pr-10" : "pr-2",
                )}
                autoComplete="off"
                aria-label="Search fin catalog"
              />
              {query.trim().length > 0 ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  className="absolute right-1 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted/80 hover:text-foreground"
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
            </SiteSearchShell>
            <p className="text-xs text-muted-foreground/60">
              Only fin brands and models from our catalog are shown (brands tagged as fin
              manufacturers).
            </p>
          </form>
        </div>

        {showResultsPanel ? (
          <section
            className={cn(
              "mt-8 w-full",
              "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
              "md:mt-10 md:rounded-none md:border-0 md:border-t md:bg-transparent md:pt-2 md:shadow-none",
            )}
            aria-live="polite"
          >
            {loading && !hasResults ? (
              <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted-foreground md:py-16 md:text-base">
                <Loader2 className="h-4 w-4 animate-spin md:h-5 md:w-5" aria-hidden />
                Searching fin catalog…
              </div>
            ) : null}

            {error ? (
              <div className="px-4 py-6 text-sm text-destructive sm:px-6 md:px-8 md:text-base">{error}</div>
            ) : null}

            {showNoMatches ? (
              <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 text-sm sm:px-6 md:py-10 md:text-base">
                <p className="text-muted-foreground">
                  No fin catalog matches for that search. You can still list your fins manually —
                  brand and model don&apos;t have to be in our directory.
                </p>
                <Button type="button" variant="secondary" className="w-full min-h-touch md:w-auto" onClick={onSkip}>
                  Continue without a catalog match
                </Button>
              </div>
            ) : null}

            {hasResults ? (
              <div className="max-h-[min(65dvh,560px)] overflow-y-auto overscroll-contain md:max-h-none md:overflow-visible">
                {topPick ? (
                  <ResultsSection title="Top pick from the fin catalog">
                    <CatalogMatchRow row={topPick} onSelect={onSelect} emphasized />
                  </ResultsSection>
                ) : null}

                {moreMatches.length > 0 ? (
                  <ResultsSection title="More catalog matches">
                    {moreMatches.map((row) => (
                      <CatalogMatchRow key={rowKey(row)} row={row} onSelect={onSelect} />
                    ))}
                  </ResultsSection>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="mx-auto mt-8 max-w-2xl">
          <Button type="button" variant="ghost" className="text-muted-foreground" onClick={onSkip}>
            List manually without searching
          </Button>
        </div>
      </div>
    </main>
  )
}
