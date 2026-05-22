"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { SlidersHorizontal, Tag, Package, Type, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { capitalizeWords, formatCondition } from "@/lib/listing-labels"
import { searchBrandsCatalogSuggest, searchSuggest, type SearchSuggestBrandChip } from "@/app/actions/marketplace"
import type { BrandCatalogSuggestRow } from "@/lib/services/brandDirectorySearch"
import { recordSearchSuggestPick } from "@/app/actions/search-suggest-analytics"
import type {
  SearchSuggestPickKind,
  SearchSuggestPickSurface,
  SearchSuggestPickTrace,
} from "@/lib/elasticsearch/search-suggest-analytics-index"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { listingDetailHref } from "@/lib/listing-href"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import { useSearchSuggestPortalContainer } from "@/components/search-suggest-portal-context"

/** Max rows in the combined Suggestions list (titles / categories / brands). */
const SUGGEST_COMBINED_CAP = 24

/** Matches `hooks/use-mobile` — below this, panel spans the sheet/viewport (not only the text field). */
const SUGGEST_PANEL_COMPACT_VIEWPORT_PX = 768

/** Log a suggest hover after the pointer rests on a row (reduces noise vs raw mousemove). */
const SUGGEST_HOVER_DWELL_MS = 450

function getSuggestPanelLayout(args: {
  top: number
  /** Anchor (input wrapper) — used on non-compact layouts. */
  anchorLeft: number
  anchorWidth: number
  /** When suggestions portal into the mobile nav sheet, center within this rect. */
  portalRect: { left: number; width: number } | null
  /**
   * When true, the panel width tracks the anchor's width exactly (no 400/520 clamp).
   * Used by main-nav search so the dropdown is flush with the search bar.
   */
  matchAnchorWidth?: boolean
}) {
  if (typeof window === "undefined") return null
  const vw = window.innerWidth
  const vh = window.innerHeight
  const gutter = vw < 640 ? 12 : 16
  const maxAllowableWidth = Math.max(200, vw - 2 * gutter)
  const compactViewport = vw < SUGGEST_PANEL_COMPACT_VIEWPORT_PX
  const narrowPhone = vw < 640

  let width: number
  let left: number

  if (args.matchAnchorWidth && (!args.portalRect || args.portalRect.width <= 0)) {
    width = Math.min(args.anchorWidth, maxAllowableWidth)
    left = Math.max(gutter, Math.min(args.anchorLeft, vw - width - gutter))
  } else if (compactViewport) {
    if (args.portalRect && args.portalRect.width > 0) {
      const inner = Math.max(0, args.portalRect.width - 2 * gutter)
      width = inner > 0 ? Math.min(maxAllowableWidth, inner) : maxAllowableWidth
      left = args.portalRect.left + (args.portalRect.width - width) / 2
    } else if (narrowPhone) {
      width = maxAllowableWidth
      left = (vw - width) / 2
    } else {
      width = Math.min(args.anchorWidth, maxAllowableWidth)
      left = Math.max(gutter, Math.min(args.anchorLeft, vw - width - gutter))
    }
  } else {
    width = Math.min(
      Math.max(args.anchorWidth, 400),
      520,
      maxAllowableWidth,
    )
    left = Math.max(gutter, Math.min(args.anchorLeft, vw - width - gutter))
  }

  const spaceBelow = vh - args.top - gutter
  const maxHeight = Math.min(520, Math.max(160, spaceBelow), vh * 0.72)
  return { width, left, maxHeight }
}

export type SuggestListing = {
  id: string
  slug: string | null
  title: string
  price: number
  section: string
  imageUrl: string | null
  brand: string | null
  city: string | null
  state: string | null
  condition: string | null
}

export interface SuggestResult {
  titles: string[]
  categories: string[]
  brands: SearchSuggestBrandChip[]
  listings?: SuggestListing[]
  meta: { listingsBackend: "elasticsearch" | "supabase" }
}

/**
 * Nav search omits the bottom “Suggestions” list and does not open the panel for title-only
 * matches (no listing, category, or brand strip).
 */
function marketplaceDropdownHasVisibleSections(data: SuggestResult, showTextSuggestions: boolean): boolean {
  const listings = data.listings ?? []
  if (
    listings.length > 0 ||
    (data.brands?.length ?? 0) > 0 ||
    (data.categories?.length ?? 0) > 0
  ) {
    return true
  }
  if (!showTextSuggestions) return false
  const listingTitlesLower = new Set(listings.map((l) => l.title.toLowerCase()))
  const extraTitles = (data.titles ?? []).filter((t) => !listingTitlesLower.has(t.toLowerCase()))
  return extraTitles.some((t) => t.trim().length > 0)
}

interface SearchInputWithSuggestProps {
  value: string
  onChange: (value: string) => void
  onSelect?: (value: string) => void
  placeholder?: string
  /** "surfboards" | "new" to scope suggestions (default surfboards when empty). */
  section?: string
  className?: string
  inputClassName?: string
  minLength?: number
  debounceMs?: number
  listboxId?: string
  showTypeLabels?: boolean
  leftIcon?: React.ReactNode
  name?: string
  disableSuggest?: boolean
  autoFocus?: boolean
  /** Clear (×) inside the field when there is text (Pango-style). */
  showClearButton?: boolean
  /** Called when user navigates from a listing or "View all results" — use to clear the input. */
  onNavigate?: () => void
  /** Called when the input receives focus. */
  onFocus?: () => void
  /**
   * When false, the query-driven fetch still fills suggestions but does not open the menu.
   * Prevents flashing after navigating to `/search` (URL sync + focused input).
   * User can still open via focus (cached suggestions) or by typing on other routes.
   */
  autoOpenDropdownOnFetch?: boolean
  /**
   * Surfboards filter bar: match `/sell` title field dropdown — `rounded-md` panel, vertical brand rows.
   */
  variant?: "default" | "boards"
  /**
   * `brands` — `public.brands` directory (Elasticsearch when configured, else Supabase).
   * `marketplace` — default marketplace listing suggestions.
   */
  suggestSource?: "marketplace" | "brands"
  /** When the user picks a row from `suggestSource="brands"`. */
  onCatalogBrandPicked?: (b: { id: string; name: string; slug: string }) => void
  /**
   * Marketplace source only: user chose a **brand name** from listing-derived suggestions
   * (BRANDS row/strip or brand suggestion). Prefer over `onSelect` for catalog-scoped search.
   * When the chip resolved to `public.brands`, `catalogSlug` is set so the handler can route to `/brands/{slug}` without a second lookup.
   */
  onBrandStripPick?: (
    brandDisplayName: string,
    resolved?: { catalogSlug: string } | null,
  ) => void
  /** Fires when a `brands` search finishes (e.g. show “request brand” when count is 0). */
  onBrandsSearchSettled?: (query: string, resultCount: number) => void
  /** Where this typeahead lives — drives search analytics “dropdown pick” events. */
  analyticsSurface?: SearchSuggestPickSurface
  /** Marketplace only: user navigated to a listing via “Top listings”. Used for nav idle suggestions ranking. */
  onMarketplaceTopListingNavigate?: (listingId: string) => void
  /**
   * Marketplace: show the “Suggestions” block (title/category/brand text rows). Nav passes `false`
   * so only Top listings + Categories + Brands strips appear.
   */
  showTextSuggestions?: boolean
  inputType?: "search" | "text"
  id?: string
  disabled?: boolean
  /**
   * When true, the suggestions panel width tracks the input's width exactly.
   * Used by main-nav search so dropdowns are flush with the search bar.
   */
  matchAnchorWidth?: boolean
}

function listingHref(listing: SuggestListing) {
  return listingDetailHref(listing)
}

function listingSectionLabel(section: string) {
  if (section === "surfboards") return "Surfboard"
  if (section === "new") return "Shop"
  return "Listing"
}

function MarketplaceSuggestPanelSkeleton({
  boardsTitleStyle,
  showBrandStrip,
}: {
  boardsTitleStyle: boolean
  showBrandStrip: boolean
}) {
  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/20 px-3 py-2 sm:flex-nowrap sm:gap-3 sm:px-4 sm:py-2.5">
        <Skeleton className="h-4 w-24 sm:h-[18px]" />
        <Skeleton className="h-4 w-28 sm:h-[18px]" />
      </div>
      <ul className="min-h-0 py-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="mx-1 flex gap-2 px-2 py-2.5 sm:gap-3 sm:rounded-xl sm:py-2.5"
          >
            <Skeleton
              className={cn(
                "shrink-0 rounded-md sm:rounded-lg",
                boardsTitleStyle ? "h-9 w-9" : "h-12 w-12 sm:h-14 sm:w-14",
              )}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-full max-w-[220px]" />
              <Skeleton className="h-3 w-36 max-w-[85%]" />
              <Skeleton className="h-4 w-16" />
            </div>
          </li>
        ))}
      </ul>
      {showBrandStrip && !boardsTitleStyle ? (
        <div className="shrink-0 border-t border-border/60 px-3 pb-3 pt-2.5 sm:px-4 sm:pb-3.5 sm:pt-3">
          <Skeleton className="mb-2 h-3 w-14" />
          <div className="flex gap-3 sm:gap-4">
            {[0, 1, 2, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <Skeleton className="h-11 w-11 rounded-full sm:h-12 sm:w-12" />
                <Skeleton className="h-3 w-14" />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}

function BrandsSuggestPanelSkeleton() {
  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/20 px-3 py-2 sm:px-4 sm:py-2.5">
        <Skeleton className="h-4 w-16 sm:h-[18px]" />
      </div>
      <ul className="min-h-0 py-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="mx-1 flex gap-2 px-2 py-2.5 sm:gap-3 sm:rounded-xl sm:py-2.5"
          >
            <Skeleton className="h-12 w-12 shrink-0 rounded-md sm:h-14 sm:w-14 sm:rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-full max-w-[200px]" />
              <Skeleton className="h-3 w-40 max-w-[90%]" />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

async function fetchSearchSuggestionsJson(
  q: string,
  section: string,
): Promise<{ data: SuggestResult; hasAny: boolean }> {
  const res = await searchSuggest(q, section)
  const listings = res.listings ?? []
  const data: SuggestResult = {
    titles: res.titles,
    categories: res.categories,
    brands: res.brands,
    listings,
    meta: res.meta,
  }
  const hasAny =
    listings.length > 0 ||
    (data.titles?.length ?? 0) > 0 ||
    (data.categories?.length ?? 0) > 0 ||
    (data.brands?.length ?? 0) > 0
  return { data, hasAny }
}

export function SearchInputWithSuggest({
  value,
  onChange,
  onSelect,
  placeholder = "Search...",
  section = "",
  className = "",
  inputClassName = "",
  minLength = 2,
  debounceMs = 200,
  listboxId = "search-suggestions",
  showTypeLabels = true,
  leftIcon,
  name,
  disableSuggest = false,
  autoFocus = false,
  showClearButton = true,
  autoOpenDropdownOnFetch = true,
  onNavigate,
  onFocus: onFocusProp,
  variant = "default",
  suggestSource = "marketplace",
  onCatalogBrandPicked,
  onBrandStripPick,
  onBrandsSearchSettled,
  analyticsSurface = "other",
  onMarketplaceTopListingNavigate,
  showTextSuggestions = true,
  inputType = "search",
  id: inputId,
  disabled = false,
  matchAnchorWidth = false,
}: SearchInputWithSuggestProps) {
  const isBrands = suggestSource === "brands"
  const boardsTitleStyle = variant === "boards" && !isBrands
  const panelTopRounded = boardsTitleStyle ? "rounded-t-md" : "rounded-t-2xl"
  const [suggestions, setSuggestions] = useState<SuggestResult | null>(null)
  const [brandRows, setBrandRows] = useState<BrandCatalogSuggestRow[] | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dropdownRect, setDropdownRect] = useState<{
    dropTop: number
    anchorLeft: number
    anchorWidth: number
    portalTop: number | null
    portalLeft: number | null
    portalWidth: number | null
  } | null>(null)
  const suggestPortalContainer = useSearchSuggestPortalContainer()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const onBrandsSearchSettledRef = useRef(onBrandsSearchSettled)
  onBrandsSearchSettledRef.current = onBrandsSearchSettled
  const router = useRouter()
  /** Bumps when user dismisses or starts a new fetch; stale async results must not reopen the dropdown. */
  const suggestGenerationRef = useRef(0)
  const suggestBackendMetaRef = useRef<{
    marketplaceListings: "elasticsearch" | "supabase"
    brandCatalog: "elasticsearch" | "supabase"
  }>({ marketplaceListings: "supabase", brandCatalog: "supabase" })
  const valueRef = useRef(value)
  valueRef.current = value
  const hoverTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const invalidatePendingSuggest = () => {
    suggestGenerationRef.current += 1
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }

  const isSearchInputFocused = () =>
    Boolean(inputRef.current && document.activeElement === inputRef.current)

  const applySuggestFetchResult = (
    generation: number,
    data: SuggestResult,
    hasAny: boolean,
    source: "valueEffect" | "focus",
  ) => {
    if (generation !== suggestGenerationRef.current) return
    const effectiveHasAny =
      hasAny &&
      (suggestSource !== "marketplace" || marketplaceDropdownHasVisibleSections(data, showTextSuggestions))
    if (effectiveHasAny) {
      suggestBackendMetaRef.current.marketplaceListings = data.meta.listingsBackend
    }
    setSuggestions(effectiveHasAny ? data : null)
    if (!effectiveHasAny) {
      setOpen(false)
      return
    }
    if (source === "focus") {
      setOpen(isSearchInputFocused())
      return
    }
    // Query changed (typing or parent sync). Never auto-open on /search-style parents.
    if (!autoOpenDropdownOnFetch) {
      setOpen(false)
      return
    }
    setOpen(isSearchInputFocused())
  }

  useEffect(() => {
    if (suggestSource === "brands" || disableSuggest) return
    const q = value.trim()
    if (q.length < minLength) {
      invalidatePendingSuggest()
      setSuggestions(null)
      setOpen(false)
      setLoading(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const generation = ++suggestGenerationRef.current
      void (async () => {
        if (generation !== suggestGenerationRef.current) return
        if (q.length < minLength) return
        setLoading(true)
        if (isSearchInputFocused()) setOpen(true)
        try {
          const { data, hasAny } = await fetchSearchSuggestionsJson(q, section)
          if (generation !== suggestGenerationRef.current) return
          applySuggestFetchResult(generation, data, hasAny, "valueEffect")
        } finally {
          if (generation === suggestGenerationRef.current) setLoading(false)
        }
      })()
    }, debounceMs)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [
    value,
    section,
    minLength,
    debounceMs,
    disableSuggest,
    autoOpenDropdownOnFetch,
    suggestSource,
    showTextSuggestions,
  ])

  useEffect(() => {
    if (suggestSource !== "brands" || disableSuggest) return
    const q = value.trim()
    if (q.length < minLength) {
      invalidatePendingSuggest()
      setBrandRows(null)
      setOpen(false)
      setLoading(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const generation = ++suggestGenerationRef.current
      void (async () => {
        if (generation !== suggestGenerationRef.current) return
        if (q.length < minLength) return
        setLoading(true)
        if (isSearchInputFocused()) setOpen(true)
        try {
          const { rows, meta } = await searchBrandsCatalogSuggest(q)
          if (generation !== suggestGenerationRef.current) return
          suggestBackendMetaRef.current.brandCatalog = meta.backend
          setBrandRows(rows)
          onBrandsSearchSettledRef.current?.(q, rows.length)
          if (rows.length === 0) {
            setOpen(false)
            return
          }
          if (!autoOpenDropdownOnFetch) {
            setOpen(false)
            return
          }
          setOpen(isSearchInputFocused())
        } finally {
          if (generation === suggestGenerationRef.current) setLoading(false)
        }
      })()
    }, debounceMs)
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [
    value,
    minLength,
    debounceMs,
    suggestSource,
    disableSuggest,
    autoOpenDropdownOnFetch,
  ])

  const listings = suggestions?.listings ?? []
  const listingTitlesLower = new Set(listings.map((l) => l.title.toLowerCase()))
  const extraTitles = (suggestions?.titles ?? []).filter((t) => !listingTitlesLower.has(t.toLowerCase()))

  /** Avoid duplicating brands/categories already shown in the rich strips. */
  const flatSuggestionsRaw =
    listings.length > 0
      ? extraTitles.map((t) => ({ type: "title" as const, text: t })).slice(0, SUGGEST_COMBINED_CAP)
      : [
          ...(suggestions?.categories?.map((c) => ({ type: "category" as const, text: c })) ?? []),
          ...(suggestions?.brands?.map((b) => ({
            type: "brand" as const,
            text: b.listingLabel,
            catalogSlug: b.slug,
          })) ?? []),
          ...extraTitles.map((t) => ({ type: "title" as const, text: t })),
        ].slice(0, SUGGEST_COMBINED_CAP)
  const flatSuggestions = showTextSuggestions ? flatSuggestionsRaw : []

  const hasRichStrip =
    !disableSuggest &&
    open &&
    suggestions &&
    (listings.length > 0 || (suggestions.brands?.length ?? 0) > 0 || (suggestions.categories?.length ?? 0) > 0)

  const hasFallbackList = !disableSuggest && open && flatSuggestions.length > 0
  const queryMeetsSuggestMin = value.trim().length >= minLength
  const showLoadingPanel =
    loading && !disableSuggest && open && queryMeetsSuggestMin
  const showMarketplacePanel =
    !showLoadingPanel &&
    suggestSource === "marketplace" &&
    (hasRichStrip || hasFallbackList)
  const showBrandsPanel =
    !showLoadingPanel &&
    suggestSource === "brands" &&
    !disableSuggest &&
    open &&
    (brandRows?.length ?? 0) > 0
  const showPanelForRect = showMarketplacePanel || showBrandsPanel || showLoadingPanel

  /** When listings share the panel with brands/categories/suggestions, flex so listings scroll instead of clipping the footer. */
  const listingsSharePanelWithFooter =
    listings.length > 0 &&
    ((suggestions?.brands?.length ?? 0) > 0 ||
      (suggestions?.categories?.length ?? 0) > 0 ||
      flatSuggestions.length > 0)

  /**
   * Categories / suggestion lists can scroll within a capped height when Top listings is open.
   * Brand strip stays `shrink-0` so circular chips and labels are never clipped by flex shrink.
   */
  const suggestDropdownFooterShrinkable = listingsSharePanelWithFooter

  /** Tighter suggestion list budget when listings are present so Brands + Suggestions cannot dominate the panel height. */
  const suggestionsListMaxClass = suggestDropdownFooterShrinkable
    ? "max-h-[min(26dvh,176px)] sm:max-h-[min(28dvh,192px)]"
    : "max-h-[min(36dvh,240px)] sm:max-h-[min(40vh,280px)]"

  useEffect(() => {
    if (!showPanelForRect || !containerRef.current || typeof document === "undefined") {
      setDropdownRect(null)
      return
    }
    const el = containerRef.current
    /**
     * When `matchAnchorWidth` is on, the dropdown should be flush with the enclosing
     * search bar form (input + submit button), not just the inner input wrapper —
     * so it matches the idle dropdown in `HeaderNavSearch`, which measures the form.
     */
    const widthAnchor = matchAnchorWidth ? el.closest("form") ?? el : el
    const update = () => {
      const rect = el.getBoundingClientRect()
      const widthRect = widthAnchor === el ? rect : widthAnchor.getBoundingClientRect()
      const dropTop = widthRect.bottom + 8
      let portalTop: number | null = null
      let portalLeft: number | null = null
      let portalWidth: number | null = null
      if (suggestPortalContainer) {
        const pr = suggestPortalContainer.getBoundingClientRect()
        portalTop = pr.top
        portalLeft = pr.left
        portalWidth = pr.width
      }
      setDropdownRect({
        dropTop,
        anchorLeft: widthRect.left,
        anchorWidth: widthRect.width,
        portalTop,
        portalLeft,
        portalWidth,
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
  }, [showPanelForRect, suggestPortalContainer, matchAnchorWidth])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      invalidatePendingSuggest()
      setOpen(false)
    }
    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [])

  useEffect(() => {
    return () => {
      for (const t of hoverTimersRef.current.values()) clearTimeout(t)
      hoverTimersRef.current.clear()
    }
  }, [])

  /** After choosing a link result: kill stale fetches, clear cache, blur so focus doesn’t reopen the menu. */
  const dismissForNavigation = () => {
    invalidatePendingSuggest()
    setOpen(false)
    setSuggestions(null)
    setLoading(false)
    if (inputRef.current && document.activeElement === inputRef.current) inputRef.current.blur()
  }

  const logSuggestAnalytics = useCallback(
    (args: {
      pickKind: SearchSuggestPickKind
      selectionLabel: string
      listingId?: string | null
      interaction?: "pick" | "hover"
    }) => {
      const q = valueRef.current.trim()
      const minQ = isBrands ? 1 : minLength
      if (q.length < minQ) return

      let suggestTrace: SearchSuggestPickTrace
      if (isBrands) {
        suggestTrace =
          suggestBackendMetaRef.current.brandCatalog === "elasticsearch"
            ? "brand_catalog_elasticsearch"
            : "brand_catalog_supabase"
      } else {
        suggestTrace =
          suggestBackendMetaRef.current.marketplaceListings === "elasticsearch"
            ? "marketplace_elasticsearch"
            : "marketplace_supabase"
      }

      void recordSearchSuggestPick({
        surface: analyticsSurface,
        pickKind: args.pickKind,
        suggestTrace,
        queryPrefix: q,
        selectionLabel: args.selectionLabel,
        listingId: args.listingId ?? null,
        interaction: args.interaction ?? "pick",
      })
    },
    [minLength, isBrands, analyticsSurface],
  )

  const scheduleSuggestHover = useCallback(
    (
      rowKey: string,
      args: {
        pickKind: SearchSuggestPickKind
        selectionLabel: string
        listingId?: string | null
      },
    ) => {
      const existing = hoverTimersRef.current.get(rowKey)
      if (existing) clearTimeout(existing)
      const t = setTimeout(() => {
        hoverTimersRef.current.delete(rowKey)
        logSuggestAnalytics({ ...args, interaction: "hover" })
      }, SUGGEST_HOVER_DWELL_MS)
      hoverTimersRef.current.set(rowKey, t)
    },
    [logSuggestAnalytics],
  )

  const cancelSuggestHover = useCallback((rowKey: string) => {
    const existing = hoverTimersRef.current.get(rowKey)
    if (existing) {
      clearTimeout(existing)
      hoverTimersRef.current.delete(rowKey)
    }
  }, [])

  const handleSelectText = (text: string, pickKind: SearchSuggestPickKind) => {
    logSuggestAnalytics({ pickKind, selectionLabel: text, listingId: null })
    invalidatePendingSuggest()
    onChange(text)
    onSelect?.(text)
    setOpen(false)
    setSuggestions(null)
  }

  const pickMarketplaceBrandLabel = (
    brandName: string,
    pickKind: SearchSuggestPickKind,
    catalogSlug?: string | null,
  ) => {
    if (onBrandStripPick && !isBrands) {
      logSuggestAnalytics({ pickKind, selectionLabel: brandName, listingId: null })
      invalidatePendingSuggest()
      const slug = catalogSlug?.trim()
      if (slug) {
        onBrandStripPick(brandName, { catalogSlug: slug })
      } else {
        onBrandStripPick(brandName)
      }
      setOpen(false)
      setSuggestions(null)
      setLoading(false)
      if (inputRef.current && document.activeElement === inputRef.current) inputRef.current.blur()
      return
    }
    const slugOnly = catalogSlug?.trim()
    if (slugOnly) {
      logSuggestAnalytics({ pickKind, selectionLabel: brandName, listingId: null })
      invalidatePendingSuggest()
      onNavigate?.()
      router.push(`${BRANDS_BASE}/${encodeURIComponent(slugOnly)}`)
      dismissForNavigation()
      return
    }
    handleSelectText(brandName, pickKind)
  }

  const handleBrandCatalogPick = (b: BrandCatalogSuggestRow) => {
    logSuggestAnalytics({
      pickKind: "brand_catalog",
      selectionLabel: b.name,
      listingId: null,
    })
    invalidatePendingSuggest()
    onChange(b.name)
    onSelect?.(b.name)
    onCatalogBrandPicked?.({ id: b.id, name: b.name, slug: b.slug })
    setOpen(false)
    setBrandRows(null)
    setLoading(false)
    if (inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.blur()
    }
  }

  const panelLayout =
    dropdownRect && typeof window !== "undefined"
      ? getSuggestPanelLayout({
          top: dropdownRect.dropTop,
          anchorLeft: dropdownRect.anchorLeft,
          anchorWidth: dropdownRect.anchorWidth,
          portalRect:
            dropdownRect.portalLeft != null && dropdownRect.portalWidth != null
              ? { left: dropdownRect.portalLeft, width: dropdownRect.portalWidth }
              : null,
          matchAnchorWidth,
        })
      : null

  const portaledInsideModal =
    Boolean(
      suggestPortalContainer &&
        dropdownRect?.portalTop != null &&
        dropdownRect?.portalLeft != null,
    )

  const dropdownPanel =
    showPanelForRect &&
    dropdownRect &&
    panelLayout &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={dropdownRef}
        id={listboxId}
        role="listbox"
        data-search-suggest-panel=""
        className={cn(
          "flex min-h-0 flex-col overflow-hidden border bg-popover text-popover-foreground touch-pan-y pointer-events-auto",
          portaledInsideModal ? "absolute z-[80]" : "fixed z-[160]",
          boardsTitleStyle
            ? "rounded-md border-border shadow-md"
            : "max-sm:rounded-xl rounded-2xl border-border/80 shadow-xl shadow-black/10 max-sm:shadow-2xl",
        )}
        style={
          portaledInsideModal
            ? {
                top: dropdownRect.dropTop - (dropdownRect.portalTop ?? 0),
                left: panelLayout.left - (dropdownRect.portalLeft ?? 0),
                width: panelLayout.width,
                maxHeight: panelLayout.maxHeight,
              }
            : {
                top: dropdownRect.dropTop,
                left: panelLayout.left,
                width: panelLayout.width,
                maxHeight: panelLayout.maxHeight,
              }
        }
        aria-busy={showLoadingPanel}
      >
        {showLoadingPanel ? (
          isBrands ? (
            <BrandsSuggestPanelSkeleton />
          ) : (
            <MarketplaceSuggestPanelSkeleton
              boardsTitleStyle={boardsTitleStyle}
              showBrandStrip={!showTextSuggestions}
            />
          )
        ) : null}
        {!showLoadingPanel && isBrands && showBrandsPanel && brandRows ? (
          <>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/20 px-3 py-2 sm:px-4 sm:py-2.5">
              <span className="text-xs font-semibold tracking-tight text-foreground sm:text-sm">
                Brands
              </span>
            </div>
            <ul className="min-h-0 max-h-[min(42dvh,280px)] overflow-y-auto overscroll-contain py-1 sm:max-h-[min(45dvh,360px)]">
              {brandRows.map((item) => {
                const lineMeta = [
                  item.location_label,
                  item.lead_shaper_name,
                ]
                  .map((s) => (typeof s === "string" ? s.trim() : ""))
                  .filter(Boolean)
                  .join(" · ")
                const desc = item.short_description?.trim()
                const meta =
                  lineMeta ||
                  (desc
                    ? desc.length > 120
                      ? `${desc.slice(0, 117)}…`
                      : desc
                    : "Brand profile")
                return (
                  <li key={item.id} role="option">
                    <button
                      type="button"
                      className="mx-1 flex w-[calc(100%-0.5rem)] cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-2 text-left text-sm outline-none min-h-touch transition-colors hover:bg-muted/80 focus-visible:bg-muted/80 sm:gap-3 sm:rounded-xl sm:py-2.5"
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() =>
                        scheduleSuggestHover(`bc:${item.id}`, {
                          pickKind: "brand_catalog",
                          selectionLabel: item.name,
                          listingId: null,
                        })
                      }
                      onMouseLeave={() => cancelSuggestHover(`bc:${item.id}`)}
                      onClick={() => handleBrandCatalogPick(item)}
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted sm:h-14 sm:w-14 sm:rounded-lg">
                        {item.logo_url ? (
                          <Image
                            src={item.logo_url}
                            alt=""
                            fill
                            className="object-contain p-1.5"
                            sizes="(max-width:640px) 48px, 56px"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-cerulean sm:text-base">
                            {item.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground sm:text-base">
                          {item.name}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground sm:mt-1 sm:text-xs">
                          {meta}
                        </p>
                      </div>
                      <SlidersHorizontal
                        className="h-4 w-4 shrink-0 self-center text-muted-foreground/80 sm:h-4 sm:w-4"
                        aria-hidden
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        ) : null}
        {!showLoadingPanel && !isBrands && showMarketplacePanel && listings.length > 0 && (
          <div
            className={cn(
              "flex min-h-0 flex-col",
              listingsSharePanelWithFooter && "min-h-0 flex-1",
            )}
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/20 px-3 py-2 sm:flex-nowrap sm:gap-3 sm:px-4 sm:py-2.5">
              <span className="text-xs font-semibold tracking-tight text-foreground sm:text-sm">
                Top listings
              </span>
              <Link
                href={`/search?q=${encodeURIComponent(value.trim())}`}
                className="shrink-0 text-xs font-medium text-cerulean hover:text-pacific hover:underline sm:text-sm"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() =>
                  scheduleSuggestHover("view_all", {
                    pickKind: "view_all_results",
                    selectionLabel: valueRef.current.trim() || "view all",
                    listingId: null,
                  })
                }
                onMouseLeave={() => cancelSuggestHover("view_all")}
                onClick={(e) => {
                  e.preventDefault()
                  logSuggestAnalytics({
                    pickKind: "view_all_results",
                    selectionLabel: value.trim() || "view all",
                    listingId: null,
                  })
                  onNavigate?.()
                  router.push(`/search?q=${encodeURIComponent(value.trim())}`)
                  dismissForNavigation()
                }}
              >
                View all results
              </Link>
            </div>
            <ul
              className={cn(
                "min-h-0 overflow-y-auto overscroll-contain py-1",
                listingsSharePanelWithFooter
                  ? "flex-1"
                  : "max-h-[min(42dvh,280px)] sm:max-h-[min(45vh,360px)]",
              )}
            >
              {listings.map((item) => {
                const meta = [
                  listingSectionLabel(item.section),
                  item.brand || null,
                  formatCondition(item.condition),
                  item.city && item.state ? `${item.city}, ${item.state}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")

                return (
                  <li key={item.id} role="none">
                    <Link
                      href={listingHref(item)}
                      className="mx-1 flex gap-2 rounded-lg px-2 py-2 outline-none transition-colors hover:bg-muted/80 focus-visible:bg-muted/80 sm:gap-3 sm:rounded-xl sm:py-2.5"
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() =>
                        scheduleSuggestHover(`tl:${item.id}`, {
                          pickKind: "top_listing",
                          selectionLabel: item.title,
                          listingId: item.id,
                        })
                      }
                      onMouseLeave={() => cancelSuggestHover(`tl:${item.id}`)}
                      onClick={(e) => {
                        e.preventDefault()
                        logSuggestAnalytics({
                          pickKind: "top_listing",
                          selectionLabel: item.title,
                          listingId: item.id,
                        })
                        onMarketplaceTopListingNavigate?.(item.id)
                        onNavigate?.()
                        router.push(listingHref(item))
                        dismissForNavigation()
                      }}
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted sm:h-14 sm:w-14 sm:rounded-lg">
                        {item.imageUrl ? (
                          <Image
                            src={proxiedListingImageSrc(item.imageUrl)}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="(max-width:640px) 48px, 56px"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                            No photo
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground sm:text-base">
                          {capitalizeWords(item.title)}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground sm:text-xs">
                          {meta}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-black dark:text-white sm:mt-1">
                          ${item.price.toFixed(2)}
                        </p>
                      </div>
                      <span className="hidden shrink-0 self-center text-sm font-medium text-cerulean sm:inline">
                        View
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {(suggestions?.brands?.length ?? 0) > 0 && (
          <div
            className={cn(
              "border-t border-border/60 bg-background shrink-0",
              boardsTitleStyle ? "px-0 py-0" : "px-3 pb-3 pt-2.5 sm:px-4 sm:pb-3.5 sm:pt-3",
              listings.length === 0 && panelTopRounded,
            )}
          >
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                boardsTitleStyle ? "mb-0 px-3 pt-3" : "mb-2",
              )}
            >
              Brands
            </p>
            {boardsTitleStyle ? (
              <ul className="max-h-[min(240px,40vh)] overflow-y-auto py-1">
                {suggestions!.brands!.map((brand) => (
                  <li key={brand.listingLabel} role="option">
                    <button
                      type="button"
                      className="flex w-full cursor-pointer select-none items-center gap-2 px-3 py-2.5 text-left text-sm outline-none min-h-touch hover:bg-accent/60 focus-visible:bg-accent"
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() =>
                        scheduleSuggestHover(`brand-row:${brand.listingLabel}`, {
                          pickKind: boardsTitleStyle ? "brand_row" : "brand_strip",
                          selectionLabel: brand.listingLabel,
                          listingId: null,
                        })
                      }
                      onMouseLeave={() => cancelSuggestHover(`brand-row:${brand.listingLabel}`)}
                      onClick={() =>
                        pickMarketplaceBrandLabel(
                          brand.listingLabel,
                          boardsTitleStyle ? "brand_row" : "brand_strip",
                          brand.slug,
                        )
                      }
                    >
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-muted">
                        {brand.logo_url ? (
                          <Image
                            src={brand.logo_url}
                            alt=""
                            fill
                            className="object-contain p-1"
                            sizes="36px"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-cerulean">
                            {brand.listingLabel.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="truncate font-medium text-foreground">{brand.listingLabel}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex gap-3 overflow-x-auto overscroll-x-contain pb-1 pl-0.5 pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [scroll-padding-inline:8px] sm:gap-4 [&::-webkit-scrollbar]:hidden">
                {suggestions!.brands!.map((brand) => (
                  <button
                    key={brand.listingLabel}
                    type="button"
                    className="flex min-w-[4rem] max-w-[4.75rem] flex-col items-center gap-1.5 text-center sm:min-w-[4.5rem] sm:max-w-[5.5rem]"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() =>
                      scheduleSuggestHover(`brand-strip:${brand.listingLabel}`, {
                        pickKind: "brand_strip",
                        selectionLabel: brand.listingLabel,
                        listingId: null,
                      })
                    }
                    onMouseLeave={() => cancelSuggestHover(`brand-strip:${brand.listingLabel}`)}
                    onClick={() =>
                      pickMarketplaceBrandLabel(
                        brand.listingLabel,
                        boardsTitleStyle ? "brand_row" : "brand_strip",
                        brand.slug,
                      )
                    }
                  >
                    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-sm font-bold text-cerulean sm:h-12 sm:w-12 sm:text-base">
                      {brand.logo_url ? (
                        <Image
                          src={brand.logo_url}
                          alt=""
                          fill
                          className="object-contain p-1"
                          sizes="44px"
                          unoptimized
                        />
                      ) : (
                        brand.listingLabel.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span className="line-clamp-2 w-full text-[11px] font-medium leading-tight text-foreground sm:text-xs">
                      {brand.listingLabel}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {(suggestions?.categories?.length ?? 0) > 0 && (
          <div
            className={cn(
              "border-t border-border/60 px-3 py-2.5 sm:px-4 sm:py-3",
              suggestDropdownFooterShrinkable
                ? "min-h-0 max-h-[min(24dvh,160px)] shrink overflow-y-auto overscroll-contain"
                : "shrink-0",
            )}
          >
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:mb-2">
              Categories
            </p>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {suggestions!.categories!.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted hover:border-cerulean/30 sm:px-3 sm:py-1.5 sm:text-xs"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() =>
                    scheduleSuggestHover(`cat:${cat}`, {
                      pickKind: "category_chip",
                      selectionLabel: cat,
                      listingId: null,
                    })
                  }
                  onMouseLeave={() => cancelSuggestHover(`cat:${cat}`)}
                  onClick={() => handleSelectText(cat, "category_chip")}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {flatSuggestions.length > 0 && (
          <div
            className={cn(
              "border-t border-border/60",
              suggestDropdownFooterShrinkable
                ? "min-h-0 max-h-[min(34dvh,220px)] shrink overflow-hidden sm:max-h-[min(36dvh,240px)]"
                : "shrink-0",
              listings.length === 0 &&
                (suggestions?.brands?.length ?? 0) === 0 &&
                (suggestions?.categories?.length ?? 0) === 0 &&
                panelTopRounded,
            )}
          >
            <p className="border-b border-border/40 bg-muted/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:px-4 sm:py-2">
              Suggestions
            </p>
            <ul className={cn("overflow-y-auto overscroll-contain py-1", suggestionsListMaxClass)}>
              {flatSuggestions.map((item, i) => {
                const Icon = item.type === "category" ? Tag : item.type === "brand" ? Package : Type
                return (
                  <li key={`${item.type}-${item.text}-${i}`} role="option">
                    <button
                      type="button"
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left text-sm outline-none min-h-touch transition-colors",
                        boardsTitleStyle
                          ? "hover:bg-accent/60 focus-visible:bg-accent"
                          : "mx-1 w-[calc(100%-0.5rem)] rounded-lg py-2 hover:bg-muted/80 focus-visible:bg-muted/80",
                      )}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => {
                        const kind: SearchSuggestPickKind =
                          item.type === "title"
                            ? "suggestion_title"
                            : item.type === "brand"
                              ? "suggestion_brand"
                              : "suggestion_category"
                        scheduleSuggestHover(`sg:${item.type}:${item.text}:${i}`, {
                          pickKind: kind,
                          selectionLabel: item.text,
                          listingId: null,
                        })
                      }}
                      onMouseLeave={() =>
                        cancelSuggestHover(`sg:${item.type}:${item.text}:${i}`)
                      }
                      onClick={() =>
                        item.type === "brand"
                          ? pickMarketplaceBrandLabel(item.text, "suggestion_brand", item.catalogSlug)
                          : handleSelectText(
                              item.text,
                              item.type === "title"
                                ? "suggestion_title"
                                : "suggestion_category",
                            )
                      }
                    >
                      {showTypeLabels && item.type !== "title" ? (
                        <>
                          <span className="flex shrink-0 items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            <Icon className="h-3 w-3" />
                            {item.type}
                          </span>
                          <span className="min-w-0 truncate font-medium text-foreground">{item.text}</span>
                        </>
                      ) : (
                        <span className="min-w-0 truncate font-medium text-foreground">{item.text}</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>,
      suggestPortalContainer ?? document.body,
    )

  const showClear = showClearButton && value.length > 0

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {leftIcon && (
        <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">
          {leftIcon}
        </div>
      )}
      <Input
        type={inputType}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          onFocusProp?.()
          if (disableSuggest) return
          const q = value.trim()
          if (q.length < minLength) return
          if (suggestSource === "brands") {
            if ((brandRows?.length ?? 0) > 0) {
              setOpen(true)
              return
            }
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => {
              const gen = ++suggestGenerationRef.current
              void (async () => {
                if (gen !== suggestGenerationRef.current) return
                if (q.length < minLength) return
                setLoading(true)
                setOpen(true)
                try {
                  const { rows, meta } = await searchBrandsCatalogSuggest(q)
                  if (gen !== suggestGenerationRef.current) return
                  suggestBackendMetaRef.current.brandCatalog = meta.backend
                  setBrandRows(rows)
                  onBrandsSearchSettledRef.current?.(q, rows.length)
                  if (rows.length > 0) {
                    setOpen(isSearchInputFocused())
                  } else {
                    setOpen(false)
                  }
                } finally {
                  if (gen === suggestGenerationRef.current) setLoading(false)
                }
              })()
            }, debounceMs)
            return
          }
          const s = suggestions
          const has =
            (s?.listings?.length ?? 0) > 0 ||
            (s?.categories?.length ?? 0) > 0 ||
            (s?.brands?.length ?? 0) > 0 ||
            (showTextSuggestions && (s?.titles?.length ?? 0) > 0)
          if (has) {
            setOpen(true)
            return
          }
          // Repopulate after navigate/dismiss cleared suggestions (same query still in the field).
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => {
            const gen = ++suggestGenerationRef.current
            void (async () => {
              if (gen !== suggestGenerationRef.current) return
              setLoading(true)
              setOpen(true)
              try {
                const { data, hasAny } = await fetchSearchSuggestionsJson(q, section)
                if (gen !== suggestGenerationRef.current) return
                applySuggestFetchResult(gen, data, hasAny, "focus")
              } finally {
                if (gen === suggestGenerationRef.current) setLoading(false)
              }
            })()
          }, debounceMs)
        }}
        ref={inputRef}
        id={inputId}
        disabled={disabled}
        className={cn(
          leftIcon && "pl-10",
          showClear && "pr-10",
          showClear &&
            "[&::-webkit-search-cancel-button]:hidden [&::-moz-search-clear]:hidden",
          inputClassName,
        )}
        autoComplete="off"
        aria-expanded={showPanelForRect}
        aria-busy={showLoadingPanel}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoFocus={autoFocus}
      />
      {showClear && (
        <button
          type="button"
          className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Clear search"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            invalidatePendingSuggest()
            onChange("")
            setOpen(false)
            setSuggestions(null)
            setBrandRows(null)
            setLoading(false)
          }}
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {dropdownPanel}
    </div>
  )
}
