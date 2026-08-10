"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { FocusScrim } from "@/components/focus-scrim"
import {
  navSearchTopListingThumbClassName,
} from "@/components/features/search/nav-search-top-listing-row"
import {
  NavSuggestPanelSkeleton,
  SearchInputWithSuggest,
  type ExternalSuggestConfig,
  type ExternalSuggestRenderContext,
} from "@/components/search-input-with-suggest"
import {
  SiteSearchFormSubmitButton,
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
  useSellCatalogNlHelper,
  type SellCatalogNlHelperState,
} from "@/components/features/sell/hooks/use-sell-catalog-nl-helper"
import {
  sellCatalogHandoffFromRow,
  writeSellCatalogHandoff,
} from "@/lib/sell-flow/catalog-handoff"
import { setSellEntryPoint } from "@/lib/sell-flow/sell-entry-point"
import {
  SellTrendingBrandsSlider,
  type SellTrendingBrand,
} from "@/components/features/sell/sell-trending-brands"
import { SellListByTypeLinks } from "@/components/features/sell/sell-type-chooser"
import { brandLogoDisplaySrc } from "@/lib/public-media-display-src"
import { finCatalogSearchRowThumbUrl } from "@/lib/utils/fin-catalog-display-image"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { finSetupLabel, finSizeLabel, finSystemLabel } from "@/lib/fin-listing-config"
import { compactSearchKey } from "@/lib/utils/fin-catalog-search-rank"
import { cn } from "@/lib/utils"

const SEARCH_DEBOUNCE_MS = 250

export type SellCatalogSearchProps = {
  /** Show admin-only sell types (e.g. apparel) in the “list by type” row. */
  isAdmin?: boolean
  /** Homepage trending brands — tapping one drills into that brand's models. */
  trendingBrands?: SellTrendingBrand[]
  /** Experience-based surfboard create URL (Quick vs Guided). */
  surfboardSellHref: string
  /** Optional resume-draft prompt above the search hero. */
  resumeBanner?: React.ReactNode
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
  className,
  imageSizes = "(max-width:640px) 48px, 56px",
}: {
  src: string | null | undefined
  alt: string
  fallbackLetter: string
  isLogo: boolean
  className?: string
  imageSizes?: string
}) {
  const displaySrc = src?.trim() ? brandLogoDisplaySrc(src) : null
  return (
    <div className={cn(navSearchTopListingThumbClassName, className)}>
      {displaySrc ? (
        <Image
          src={displaySrc}
          alt={alt}
          fill
          className={cn(isLogo ? "object-contain p-1.5" : "object-cover")}
          sizes={imageSizes}
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
    <li role="option" className="min-w-0">
      <button
        type="button"
        className="flex h-full w-full cursor-pointer select-none items-center gap-3 rounded-xl border border-border/70 bg-background p-2.5 text-left outline-none transition-colors hover:border-cerulean/40 hover:bg-muted/40 focus-visible:border-cerulean/40 focus-visible:bg-muted/40 sm:p-3"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onSelect(row)}
      >
        <CatalogThumb
          src={thumb}
          alt={title}
          fallbackLetter={title}
          isLogo={isLogo}
          className="h-16 w-16 rounded-lg sm:h-20 sm:w-20 sm:rounded-xl"
          imageSizes="(max-width:640px) 64px, 80px"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground sm:text-base">
            {highlightQueryParts(title, query)}
          </p>
          {meta ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {highlightQueryParts(meta, query)}
            </p>
          ) : null}
        </div>
      </button>
    </li>
  )
}

/** Block-card grid for catalog product results — 2-up on desktop so images stay large. */
const productGridClassName =
  "grid min-h-0 max-h-[min(50dvh,340px)] grid-cols-1 gap-2 overflow-y-auto overscroll-contain px-3 pb-3 pt-1 sm:max-h-[min(56dvh,480px)] sm:grid-cols-2 sm:gap-2.5 sm:px-4"

/** Quiet uppercase section label — lighter than the banded nav-search header. */
function PanelSectionHeader({ title }: { title: string }) {
  return (
    <div className="flex shrink-0 items-center px-4 pb-1 pt-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
    </div>
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
        <div>
          <PanelSectionHeader title="Suggestions" />
          <ul className="min-h-0 max-h-[min(34dvh,220px)] overflow-y-auto overscroll-contain pb-1 sm:max-h-[min(36dvh,240px)]">
            {suggestions.map((row) => (
              <SuggestionRow key={rowKey(row)} row={row} query={query} onSelect={onSelect} />
            ))}
          </ul>
        </div>
      ) : null}

      {products.length > 0 ? (
        <div>
          <PanelSectionHeader title="Catalog matches" />
          <ul className={productGridClassName}>
            {products.map((row) => (
              <ProductRow key={rowKey(row)} row={row} query={query} onSelect={onSelect} />
            ))}
          </ul>
        </div>
      ) : null}
    </>
  )
}

function NlHelperResults({
  nlHelper,
  shownKeys,
  query,
  onSelect,
}: {
  nlHelper: SellCatalogNlHelperState
  shownKeys: ReadonlySet<string>
  query: string
  onSelect: (row: SellCatalogSearchResultRow) => void
}) {
  if (nlHelper.loading) {
    return (
      <div className="flex items-center gap-2 border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cerulean" />
        Checking our catalog…
      </div>
    )
  }

  const rows = (nlHelper.data?.rows ?? []).filter((row) => !shownKeys.has(rowKey(row)))
  if (rows.length === 0) return null

  const summary = nlHelper.data?.summary?.trim()
  return (
    <div className="border-t border-border/60">
      <PanelSectionHeader
        title={summary ? `Suggested: ${summary}` : "Suggested matches"}
      />
      <ul className={productGridClassName}>
        {rows.map((row) => (
          <ProductRow key={rowKey(row)} row={row} query={query} onSelect={onSelect} />
        ))}
      </ul>
    </div>
  )
}

/**
 * Smoothly animates the dropdown between content heights: measures the inner
 * content with a ResizeObserver and transitions an explicit pixel height, so
 * result changes while typing glide instead of snapping the panel size.
 */
function AnimatedPanelHeight({ children }: { children: React.ReactNode }) {
  const innerRef = React.useRef<HTMLDivElement>(null)
  const [height, setHeight] = React.useState<number | null>(null)

  React.useLayoutEffect(() => {
    const el = innerRef.current
    if (!el) return
    setHeight(el.offsetHeight)
    const observer = new ResizeObserver(() => {
      setHeight(el.offsetHeight)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      className="overflow-hidden transition-[height] duration-200 ease-out motion-reduce:transition-none"
      style={{ height: height == null ? "auto" : `${height}px` }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  )
}

const EMPTY_NL_HELPER: SellCatalogNlHelperState = { loading: false, data: null }

function SellCatalogSearchPanel({
  ctx,
  isAdmin = false,
  surfboardSellHref,
  onSelect,
  nlHelper = EMPTY_NL_HELPER,
}: {
  ctx: ExternalSuggestRenderContext<SellCatalogSearchResult>
  isAdmin?: boolean
  surfboardSellHref: string
  onSelect: (row: SellCatalogSearchResultRow) => void
  nlHelper?: SellCatalogNlHelperState
}) {
  const { query, settled, error, data } = ctx
  const matchTier = data?.meta.matchTier ?? "none"
  const rankedRows =
    matchTier === "similar" ? (data?.similarResults ?? []) : (data?.results ?? [])
  const hasResults = rankedRows.length > 0
  const showNoMatches = settled && !hasResults && !error
  const showSimilarFallback = matchTier === "similar" && hasResults
  const shownKeys = new Set(rankedRows.map(rowKey))
  const nlHelperHasContent =
    nlHelper.loading || (nlHelper.data?.rows ?? []).some((row) => !shownKeys.has(rowKey(row)))

  if (error) {
    return <div className="px-4 py-4 text-sm text-destructive sm:px-5 sm:py-5">{error}</div>
  }

  if (showSimilarFallback) {
    return (
      <>
        <div className="border-b border-border/60 px-4 py-2.5 text-sm sm:px-4 sm:py-3">
          <p className="text-muted-foreground">
            No exact match for &ldquo;{query}&rdquo;. Closest catalog results:
          </p>
        </div>
        <DropdownResults rows={rankedRows} query={query} onSelect={onSelect} />
        <NlHelperResults
          nlHelper={nlHelper}
          shownKeys={shownKeys}
          query={query}
          onSelect={onSelect}
        />
        <div className="border-t border-border/60 px-4 py-3 sm:px-4">
          <SellListByTypeLinks
            isAdmin={isAdmin}
            surfboardHref={surfboardSellHref}
            variant="panel"
          />
        </div>
      </>
    )
  }

  if (showNoMatches) {
    return (
      <>
        {nlHelperHasContent ? (
          <NlHelperResults
            nlHelper={nlHelper}
            shownKeys={shownKeys}
            query={query}
            onSelect={onSelect}
          />
        ) : null}
        <div className="space-y-3 px-4 py-5 text-sm sm:px-4">
          <p className="text-muted-foreground">
            {nlHelperHasContent && !nlHelper.loading
              ? "Not what you're selling? You can still list without a catalog match — brand and model don't have to be in our directory."
              : "No catalog matches for that search. You can still list without a catalog match — brand and model don't have to be in our directory."}
          </p>
          <SellListByTypeLinks
            isAdmin={isAdmin}
            surfboardHref={surfboardSellHref}
            variant="panel"
          />
        </div>
      </>
    )
  }

  if (hasResults) {
    return <DropdownResults rows={rankedRows} query={query} onSelect={onSelect} />
  }

  return null
}

async function fetchSellBrandCatalogModels(
  brandId: string,
): Promise<SellCatalogSearchResultRow[]> {
  const res = await fetch(
    `/api/sell/catalog-search/brand-models?${new URLSearchParams({ brand_id: brandId })}`,
    { method: "GET", headers: { Accept: "application/json" } },
  )
  const body = (await res.json()) as {
    data?: { rows: SellCatalogSearchResultRow[] }
    error?: string
  }
  if (!res.ok || !body.data) {
    throw new Error(body.error ?? "Could not load this brand's models.")
  }
  return body.data.rows
}

/**
 * Trending-brand drill-in: "Which {brand} model is it?" — every catalog model
 * for the tapped brand as clickable blocks. Picking one runs the same handoff
 * as a search result, so it lands in the right sell flow prefilled.
 */
function SellBrandModelsPanel({
  brand,
  rows,
  loading,
  error,
  onSelect,
  onBack,
  isAdmin = false,
  surfboardSellHref,
}: {
  brand: SellTrendingBrand
  rows: SellCatalogSearchResultRow[] | null
  loading: boolean
  error: string | null
  onSelect: (row: SellCatalogSearchResultRow) => void
  onBack: () => void
  isAdmin?: boolean
  surfboardSellHref: string
}) {
  const [filter, setFilter] = React.useState("")
  const filterKey = compactSearchKey(filter)
  const visibleRows = React.useMemo(() => {
    if (!rows) return []
    if (!filterKey) return rows
    return rows.filter((row) =>
      compactSearchKey(productTitleLine(row)).includes(filterKey),
    )
  }, [rows, filterKey])

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-sm animate-in fade-in duration-150 ease-out motion-reduce:animate-none"
      aria-label={`${brand.name} catalog models`}
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5 sm:px-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 px-2 text-xs text-muted-foreground"
          onClick={onBack}
        >
          ← All brands
        </Button>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          Which {brand.name} model is it?
        </p>
      </div>

      {rows && rows.length > 8 ? (
        <div className="px-3 pt-3 sm:px-4">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Filter ${brand.name} models`}
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-cerulean/40 focus:ring-2 focus:ring-cerulean/15"
            aria-label={`Filter ${brand.name} models`}
          />
        </div>
      ) : null}

      {loading || (!error && rows === null) ? (
        <NavSuggestPanelSkeleton />
      ) : error ? (
        <div className="px-4 py-4 text-sm text-destructive">{error}</div>
      ) : visibleRows.length > 0 ? (
        <ul role="listbox" aria-label={`${brand.name} models`} className={productGridClassName}>
          {visibleRows.map((row) => (
            <ProductRow key={rowKey(row)} row={row} query={filter} onSelect={onSelect} />
          ))}
        </ul>
      ) : (
        <p className="px-4 py-5 text-sm text-muted-foreground">
          {filterKey
            ? `No ${brand.name} models match that filter.`
            : `We don't have ${brand.name} models in the catalog yet.`}
        </p>
      )}

      <div className="border-t border-border/60 px-3 py-2.5 sm:px-4">
        <SellListByTypeLinks
          isAdmin={isAdmin}
          surfboardHref={surfboardSellHref}
          variant="panel"
        />
      </div>
    </section>
  )
}

async function fetchSellCatalogSearch(query: string): Promise<SellCatalogSearchResult> {
  const res = await fetch(
    `/api/sell/catalog-search?${new URLSearchParams({ q: query })}`,
    { method: "GET", headers: { Accept: "application/json" } },
  )
  const body = (await res.json()) as { data?: SellCatalogSearchResult; error?: string }
  if (!res.ok || !body.data) {
    throw new Error(body.error ?? "Could not search the catalog. Please try again.")
  }
  return body.data
}

export function SellCatalogSearch({
  isAdmin = false,
  trendingBrands = [],
  surfboardSellHref,
  resumeBanner,
  className,
}: SellCatalogSearchProps) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [suggestOpen, setSuggestOpen] = React.useState(false)
  const [suggestState, setSuggestState] = React.useState<{
    panelOpen: boolean
    query: string
    loading: boolean
    settled: boolean
    error: string | null
    data: SellCatalogSearchResult | null
  }>({
    panelOpen: false,
    query: "",
    loading: false,
    settled: false,
    error: null,
    data: null,
  })
  const formRef = React.useRef<HTMLFormElement>(null)
  const focusStageRef = React.useRef<HTMLDivElement>(null)
  const searchEpochRef = React.useRef(0)
  const [searchFocused, setSearchFocused] = React.useState(false)

  // Trending-brand drill-in: tapping a brand swaps the slider for that brand's
  // model blocks (loaded once per brand; picking one reuses handleSelect).
  const [focusBrand, setFocusBrand] = React.useState<SellTrendingBrand | null>(null)
  const [brandModels, setBrandModels] = React.useState<SellCatalogSearchResultRow[] | null>(null)
  const [brandModelsLoading, setBrandModelsLoading] = React.useState(false)
  const [brandModelsError, setBrandModelsError] = React.useState<string | null>(null)
  const brandFetchEpochRef = React.useRef(0)

  React.useEffect(() => {
    if (!focusBrand) {
      setBrandModels(null)
      setBrandModelsError(null)
      setBrandModelsLoading(false)
      return
    }
    // The main search unmounts while a brand is focused — clear its overlay
    // state so the scrim doesn't linger when the search returns.
    setSuggestOpen(false)
    setSearchFocused(false)
    brandFetchEpochRef.current += 1
    const epoch = brandFetchEpochRef.current
    setBrandModels(null)
    setBrandModelsError(null)
    setBrandModelsLoading(true)
    fetchSellBrandCatalogModels(focusBrand.id)
      .then((rows) => {
        if (epoch !== brandFetchEpochRef.current) return
        setBrandModels(rows)
        setBrandModelsLoading(false)
      })
      .catch((err: unknown) => {
        if (epoch !== brandFetchEpochRef.current) return
        setBrandModelsError(
          err instanceof Error ? err.message : "Could not load this brand's models.",
        )
        setBrandModelsLoading(false)
      })
  }, [focusBrand])

  // Parallel AI helper: fires after the primary search settles without exact
  // matches; suggestions render below the standard results, never blocking them.
  const nlHelper = useSellCatalogNlHelper({
    query: suggestState.query,
    settled: suggestState.settled,
    matchTier: suggestState.data?.meta.matchTier ?? "none",
  })

  const handleExternalSuggestStateChange = React.useCallback(
    (state: {
      panelOpen: boolean
      query: string
      loading: boolean
      settled: boolean
      error: string | null
      data: unknown | null
    }) => {
      setSuggestState({
        panelOpen: state.panelOpen,
        query: state.query,
        loading: state.loading,
        settled: state.settled,
        error: state.error,
        data: (state.data as SellCatalogSearchResult | null) ?? null,
      })
    },
    [],
  )

  const dismissSearchFocus = React.useCallback(() => {
    setSuggestOpen(false)
    setSearchFocused(false)
    if (document.activeElement instanceof HTMLElement && formRef.current?.contains(document.activeElement)) {
      document.activeElement.blur()
    }
  }, [])

  const handleSelect = React.useCallback(
    (row: SellCatalogSearchResultRow) => {
      setSellEntryPoint("catalog_handoff")
      writeSellCatalogHandoff(sellCatalogHandoffFromRow(row))
      router.push(
        sellCatalogSearchCategorySellPath(sellCatalogSearchRowCategory(row), {
          surfboardHref: surfboardSellHref,
        }),
      )
    },
    [router, surfboardSellHref],
  )

  const runSearch = React.useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 1) return
    // Keep the suggest panel open — never auto-route on Enter. Sellers must
    // explicitly pick a result so we never send them to the wrong listing.
    setSuggestOpen(true)
    setSearchFocused(true)
  }, [])

  const externalSuggest = React.useMemo<
    ExternalSuggestConfig<SellCatalogSearchResult>
  >(
    () => ({
      minLength: 1,
      debounceMs: SEARCH_DEBOUNCE_MS,
      fetch: fetchSellCatalogSearch,
      shouldShowPanel: ({ query, loading, settled, error, data }) =>
        query.trim().length >= 1 && (loading || settled || Boolean(error) || data !== null),
      renderLoadingSkeleton: () => <NavSuggestPanelSkeleton />,
      renderPanel: (ctx) => (
        <SellCatalogSearchPanel
          ctx={ctx}
          isAdmin={isAdmin}
          surfboardSellHref={surfboardSellHref}
          onSelect={handleSelect}
        />
      ),
    }),
    [handleSelect, isAdmin, surfboardSellHref],
  )

  const showFocusScrim = searchFocused || suggestOpen
  const showResultsPanel = suggestState.panelOpen && suggestState.query.length >= 1
  const focusMode = showFocusScrim

  return (
    <main className={cn("relative flex-1 bg-background pb-12 pt-8 sm:pt-12 sm:pb-16 md:pb-24", className)}>
      <div className="container relative mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mx-auto w-full max-w-2xl space-y-8 sm:space-y-10">
          {resumeBanner && !focusMode ? resumeBanner : null}
          <header
            className={cn(
              "space-y-2 text-center transition-opacity duration-300 ease-out motion-reduce:transition-none sm:space-y-3",
              focusMode && "opacity-35",
            )}
            aria-hidden={focusMode || undefined}
          >
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              What are you listing?
            </h1>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              Search our catalog by brand or model — pick the closest match and we&apos;ll
              start your listing in the right category.
            </p>
          </header>

          {/* Brand drill-in replaces the main search — the panel has its own
              filter, so two search inputs at once would compete. */}
          {focusBrand ? null : (
          <div
            ref={focusStageRef}
            className={cn(
              "relative w-full min-w-0",
              showFocusScrim && "relative z-[70]",
            )}
            onFocusCapture={() => setSearchFocused(true)}
            onBlurCapture={(event) => {
              const next = event.relatedTarget
              if (next instanceof Node && focusStageRef.current?.contains(next)) return
              setSearchFocused(false)
            }}
          >
            <FocusScrim
              open={showFocusScrim}
              onDismiss={dismissSearchFocus}
              ariaLabel="Dismiss search"
            />
            {/* Anchor for the results panel — excludes the hint text below so the
                panel fuses directly to the bar's bottom edge. */}
            <div className="relative w-full min-w-0">
              <form
                ref={formRef}
                onSubmit={(e) => {
                  e.preventDefault()
                  void runSearch(query)
                }}
                className={cn(
                  "w-full min-w-0 overflow-hidden border border-border bg-background",
                  "transition-[border-radius,box-shadow] duration-200 ease-out motion-reduce:transition-none",
                  showResultsPanel
                    ? // Open: the panel owns the shadow; no ring so bar + panel read as one card.
                      "rounded-t-[1.75rem] rounded-b-none max-sm:rounded-t-3xl"
                    : "rounded-full focus-within:border-cerulean/40 focus-within:ring-2 focus-within:ring-cerulean/15 focus-within:shadow-sm",
                )}
              >
                <div className="flex w-full min-w-0 items-center gap-1 pl-2 pr-1.5 py-0.5">
                  <div className="relative min-w-0 flex-1">
                    <SearchInputWithSuggest
                      value={query}
                      onChange={setQuery}
                      listboxId="sell-catalog-search-listbox"
                      inputClassName={siteSearchInputClassName()}
                      placeholder="Search brand or model"
                      showTextSuggestions={false}
                      matchAnchorWidth
                      attachedDropdownNested
                      onOpenChange={setSuggestOpen}
                      onExternalSuggestStateChange={handleExternalSuggestStateChange}
                      externalSuggest={externalSuggest as ExternalSuggestConfig<unknown>}
                    />
                  </div>
                  <SiteSearchFormSubmitButton type="submit">Search</SiteSearchFormSubmitButton>
                </div>
              </form>

              {/* Results panel fused to the bar, but overlaid — it renders on top of
                  the page instead of expanding in-flow, so opening never reflows
                  surrounding content. */}
              {showResultsPanel ? (
                <div
                  id="sell-catalog-search-listbox"
                  role="listbox"
                  aria-live="polite"
                  aria-busy={suggestState.loading && !suggestState.settled}
                  className={cn(
                    "absolute inset-x-0 top-full z-[80] -mt-px overflow-hidden rounded-b-2xl border border-t border-border bg-popover text-popover-foreground shadow-md",
                    "border-t-border/60 max-sm:rounded-b-xl",
                    "max-h-[min(72dvh,520px)]",
                    "animate-in fade-in duration-150 ease-out motion-reduce:animate-none",
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault()
                  }}
                >
                  <AnimatedPanelHeight>
                    {suggestState.loading &&
                    !(suggestState.data?.results.length || suggestState.data?.similarResults?.length) ? (
                      <NavSuggestPanelSkeleton />
                    ) : (
                      <SellCatalogSearchPanel
                        ctx={{
                          query: suggestState.query,
                          loading: suggestState.loading,
                          settled: suggestState.settled,
                          error: suggestState.error,
                          data: suggestState.data,
                          dismissPanel: dismissSearchFocus,
                        }}
                        isAdmin={isAdmin}
                        surfboardSellHref={surfboardSellHref}
                        onSelect={handleSelect}
                        nlHelper={nlHelper}
                      />
                    )}
                  </AnimatedPanelHeight>
                </div>
              ) : null}
            </div>

            <p
              className={cn(
                "mt-2 text-center text-xs text-muted-foreground/70 transition-opacity duration-300 ease-out motion-reduce:transition-none",
                showResultsPanel || focusMode
                  ? "pointer-events-none opacity-0"
                  : "opacity-100",
              )}
              aria-hidden={showResultsPanel || focusMode || undefined}
            >
              Surfboards, fins, and wetsuits from our brand catalog
            </p>
          </div>
          )}

          {focusBrand ? null : (
            <div
              className={cn(
                "transition-opacity duration-300 ease-out motion-reduce:transition-none",
                focusMode && "opacity-35",
              )}
            >
              <SellListByTypeLinks
                isAdmin={isAdmin}
                surfboardHref={surfboardSellHref}
                variant="page"
              />
            </div>
          )}

          {focusBrand ? (
            <SellBrandModelsPanel
              key={focusBrand.id}
              brand={focusBrand}
              rows={brandModels}
              loading={brandModelsLoading}
              error={brandModelsError}
              onSelect={handleSelect}
              onBack={() => setFocusBrand(null)}
              isAdmin={isAdmin}
              surfboardSellHref={surfboardSellHref}
            />
          ) : trendingBrands.length > 0 ? (
            <div
              className={cn(
                "transition-opacity duration-300 ease-out motion-reduce:transition-none",
                focusMode && "pointer-events-none opacity-35",
              )}
              aria-hidden={focusMode || undefined}
            >
              <SellTrendingBrandsSlider brands={trendingBrands} onSelect={setFocusBrand} />
            </div>
          ) : null}
        </div>
      </div>
    </main>
  )
}
