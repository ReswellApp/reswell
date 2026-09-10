"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
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
import { SellListByTypeLinks } from "@/components/features/sell/sell-type-chooser"
import { brandLogoDisplaySrc } from "@/lib/public-media-display-src"
import { finCatalogSearchRowThumbUrl } from "@/lib/utils/fin-catalog-display-image"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { finSetupLabel, finSizeLabel, finSystemLabel } from "@/lib/fin-listing-config"
import { compactSearchKey } from "@/lib/utils/fin-catalog-search-rank"
import { cn } from "@/lib/utils"

const SEARCH_DEBOUNCE_MS = 160
const SELL_CATALOG_FETCH_CACHE_LIMIT = 24
const sellCatalogFetchCache = new Map<string, SellCatalogSearchResult>()

function sellCatalogCacheKey(query: string): string {
  return query.trim().toLowerCase()
}

function peekCachedSellCatalogSearch(query: string): SellCatalogSearchResult | undefined {
  return sellCatalogFetchCache.get(sellCatalogCacheKey(query))
}

function getCachedSellCatalogSearch(query: string): SellCatalogSearchResult | undefined {
  const key = sellCatalogCacheKey(query)
  const hit = sellCatalogFetchCache.get(key)
  if (!hit) return undefined
  sellCatalogFetchCache.delete(key)
  sellCatalogFetchCache.set(key, hit)
  return hit
}

function setCachedSellCatalogSearch(query: string, data: SellCatalogSearchResult): void {
  const key = sellCatalogCacheKey(query)
  sellCatalogFetchCache.delete(key)
  sellCatalogFetchCache.set(key, data)
  if (sellCatalogFetchCache.size > SELL_CATALOG_FETCH_CACHE_LIMIT) {
    const oldest = sellCatalogFetchCache.keys().next().value
    if (oldest) sellCatalogFetchCache.delete(oldest)
  }
}

function rankedRowsFromResult(data: SellCatalogSearchResult | null): SellCatalogSearchResultRow[] {
  if (!data) return []
  return data.meta.matchTier === "similar" ? data.similarResults : data.results
}

function rowMatchesQueryPrefix(row: SellCatalogSearchResultRow, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const brand = sellCatalogSearchRowBrandName(row).toLowerCase()
  const model = (sellCatalogSearchRowModelName(row) ?? "").toLowerCase()
  if (brand.includes(needle) || model.includes(needle)) return true
  const compactNeedle = compactSearchKey(needle)
  if (compactNeedle.length < 1) return false
  return (
    compactSearchKey(brand).includes(compactNeedle) ||
    compactSearchKey(model).includes(compactNeedle)
  )
}

function filterResultForQuery(
  data: SellCatalogSearchResult,
  query: string,
): SellCatalogSearchResult | null {
  const rows = rankedRowsFromResult(data).filter((row) => rowMatchesQueryPrefix(row, query))
  if (rows.length === 0) return null
  return {
    results: rows,
    similarResults: [],
    meta: { ...data.meta, matchTier: "exact" },
  }
}

export type SellCatalogSearchProps = {
  /** Show admin-only sell types (e.g. apparel) in the “list by type” row. */
  isAdmin?: boolean
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
  const category = sellCatalogSearchCategoryLabel(row.category)
  if (row.kind === "model") {
    const brand = row.brandName.trim()
    if (!brand) return category
    if (brand.toLowerCase().includes(category.toLowerCase())) return brand
    return `${brand} · ${category}`
  }
  const desc = row.shortDescription?.trim()
  if (!desc) return category
  if (desc.toLowerCase().includes(category.toLowerCase())) {
    return desc.length > 48 ? `${desc.slice(0, 45).trimEnd()}…` : desc
  }
  return `${desc.length > 48 ? `${desc.slice(0, 45).trimEnd()}…` : desc} · ${category}`
}

function rowKey(row: SellCatalogSearchResultRow): string {
  return `${row.kind}-${row.id}`
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
        className="flex w-full cursor-pointer select-none items-center gap-3 px-4 py-2 text-left outline-none transition-colors hover:bg-muted/70 focus-visible:bg-muted/70 min-h-touch"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onSelect(row)}
      >
        <CatalogThumb
          src={thumb}
          alt={title}
          fallbackLetter={title}
          isLogo={isLogo}
          className="h-10 w-10 rounded-sm sm:h-11 sm:w-11"
          imageSizes="44px"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-snug text-foreground" title={title}>
            {highlightQueryParts(title, query)}
          </p>
          {meta ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {highlightQueryParts(meta, query)}
            </p>
          ) : null}
        </div>
      </button>
    </li>
  )
}

/** Single-column typeahead list. Scroll lives on the panel, not nested here. */
const productListClassName = "min-h-0 py-1"

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
  const products = rows.filter((row) => row.kind !== "brand")
  const visible = products.length > 0 ? products : rows
  if (visible.length === 0) return null

  return (
    <ul className={productListClassName} key={query}>
      {visible.map((row) => (
        <ProductRow key={rowKey(row)} row={row} query={query} onSelect={onSelect} />
      ))}
    </ul>
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
      <ul className={productListClassName}>
        {rows.map((row) => (
          <ProductRow key={rowKey(row)} row={row} query={query} onSelect={onSelect} />
        ))}
      </ul>
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

async function fetchSellCatalogSearch(query: string): Promise<SellCatalogSearchResult> {
  const cached = getCachedSellCatalogSearch(query)
  if (cached) return cached
  const res = await fetch(
    `/api/sell/catalog-search?${new URLSearchParams({ q: query })}`,
    { method: "GET", headers: { Accept: "application/json" } },
  )
  const body = (await res.json()) as { data?: SellCatalogSearchResult; error?: string }
  if (!res.ok || !body.data) {
    throw new Error(body.error ?? "Could not search the catalog. Please try again.")
  }
  setCachedSellCatalogSearch(query, body.data)
  return body.data
}

export function SellCatalogSearch({
  isAdmin = false,
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
      router.push(sellCatalogSearchCategorySellPath(sellCatalogSearchRowCategory(row)))
    },
    [router],
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

  const displayData = React.useMemo(() => {
    const exact = peekCachedSellCatalogSearch(suggestState.query)
    if (exact) return exact
    if (suggestState.settled && suggestState.data) return suggestState.data
    if (suggestState.data) {
      return filterResultForQuery(suggestState.data, suggestState.query)
    }
    return null
  }, [suggestState.query, suggestState.settled, suggestState.data])

  const hasDisplayRows = rankedRowsFromResult(displayData).length > 0
  const showPanelSkeleton = suggestState.loading && !hasDisplayRows && !suggestState.error

  return (
    <main
      id="sell-catalog-search"
      className={cn("relative flex-1 scroll-mt-4 bg-background pb-10 pt-6 sm:pb-12 sm:pt-10", className)}
    >
      <div className="container relative mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mx-auto w-full max-w-2xl space-y-4 sm:space-y-8">
          {resumeBanner && !focusMode ? resumeBanner : null}
          <header
            className={cn(
              "space-y-1 text-left transition-opacity duration-300 ease-out motion-reduce:transition-none",
              focusMode && "opacity-35",
            )}
            aria-hidden={focusMode || undefined}
          >
            <p className="text-sm text-muted-foreground">Step 1 of 2</p>
            <h2 className="font-headline text-2xl font-bold tracking-tight text-[#001A4A] sm:text-3xl">
              Tell us what you&apos;re selling
            </h2>
          </header>

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
                    ? "rounded-t-[1.75rem] rounded-b-none border-b-0 max-sm:rounded-t-3xl"
                    : "rounded-full focus-within:border-cerulean/40 focus-within:ring-2 focus-within:ring-cerulean/15 focus-within:shadow-sm",
                )}
              >
                <div className="flex w-full min-w-0 items-center gap-0.5 pl-1 pr-1 py-0.5 sm:pl-2 sm:pr-1.5">
                  <div className="relative min-w-0 flex-1">
                    <SearchInputWithSuggest
                      value={query}
                      onChange={setQuery}
                      listboxId="sell-catalog-search-listbox"
                      inputClassName={siteSearchInputClassName()}
                      placeholder="Brand, model, or something close"
                      showTextSuggestions={false}
                      matchAnchorWidth
                      attachedDropdownNested
                      onOpenChange={setSuggestOpen}
                      onExternalSuggestStateChange={handleExternalSuggestStateChange}
                      externalSuggest={externalSuggest as ExternalSuggestConfig<unknown>}
                    />
                  </div>
                  <Button
                    type="submit"
                    size="icon"
                    variant="ghost"
                    aria-label="Search"
                    className="h-11 w-11 shrink-0 rounded-full text-foreground hover:bg-muted/60"
                  >
                    <Search className="h-5 w-5" strokeWidth={2} aria-hidden />
                  </Button>
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
                  aria-busy={suggestState.loading && !hasDisplayRows}
                  className={cn(
                    "absolute inset-x-0 top-full z-[80] overflow-y-auto overscroll-contain rounded-b-2xl border border-t-0 border-border bg-popover text-popover-foreground shadow-md",
                    "max-sm:rounded-b-xl",
                    "max-h-[min(70dvh,480px)]",
                    "animate-in fade-in duration-150 ease-out motion-reduce:animate-none",
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault()
                  }}
                >
                    {showPanelSkeleton ? (
                      <NavSuggestPanelSkeleton />
                    ) : (
                      <SellCatalogSearchPanel
                        ctx={{
                          query: suggestState.query,
                          loading: suggestState.loading,
                          settled: suggestState.settled,
                          error: suggestState.error,
                          data: displayData,
                          dismissPanel: dismissSearchFocus,
                        }}
                        isAdmin={isAdmin}
                        surfboardSellHref={surfboardSellHref}
                        onSelect={handleSelect}
                        nlHelper={nlHelper}
                      />
                    )}
                </div>
              ) : null}
            </div>
          </div>

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
        </div>
      </div>
    </main>
  )
}
