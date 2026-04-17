"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Tag, Package, Type, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { capitalizeWords, formatCondition } from "@/lib/listing-labels"
import { searchSuggest } from "@/app/actions/marketplace"
import { listingDetailHref } from "@/lib/listing-href"
import { useSearchSuggestPortalContainer } from "@/components/search-suggest-portal-context"

/** Max rows in the combined Suggestions list (titles / categories / brands). */
const SUGGEST_COMBINED_CAP = 24

/** Matches `hooks/use-mobile` — below this, suggestion panel uses full input width (no 400px floor). */
const SUGGEST_PANEL_COMPACT_VIEWPORT_PX = 768

function getSuggestPanelLayout(dropdownRect: {
  top: number
  left: number
  width: number
}) {
  if (typeof window === "undefined") return null
  const vw = window.innerWidth
  const vh = window.innerHeight
  const gutter = vw < 640 ? 12 : 16
  const maxAllowableWidth = Math.max(200, vw - 2 * gutter)
  const compactViewport = vw < SUGGEST_PANEL_COMPACT_VIEWPORT_PX
  const width = compactViewport
    ? Math.min(dropdownRect.width, maxAllowableWidth)
    : Math.min(Math.max(dropdownRect.width, 400), 520, maxAllowableWidth)
  const left = Math.max(gutter, Math.min(dropdownRect.left, vw - width - gutter))
  const spaceBelow = vh - dropdownRect.top - gutter
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
  brands: string[]
  listings?: SuggestListing[]
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
}

function listingHref(listing: SuggestListing) {
  return listingDetailHref(listing)
}

function listingSectionLabel(section: string) {
  if (section === "surfboards") return "Surfboard"
  if (section === "new") return "Shop"
  return "Listing"
}

async function fetchSearchSuggestionsJson(
  q: string,
  section: string,
): Promise<{ data: SuggestResult; hasAny: boolean }> {
  const data: SuggestResult = await searchSuggest(q, section)
  const listings = data.listings ?? []
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
}: SearchInputWithSuggestProps) {
  const boardsTitleStyle = variant === "boards"
  const panelTopRounded = boardsTitleStyle ? "rounded-t-md" : "rounded-t-2xl"
  const [suggestions, setSuggestions] = useState<SuggestResult | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dropdownRect, setDropdownRect] = useState<{
    dropTop: number
    anchorLeft: number
    anchorWidth: number
    portalTop: number | null
    portalLeft: number | null
  } | null>(null)
  const suggestPortalContainer = useSearchSuggestPortalContainer()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  /** Bumps when user dismisses or starts a new fetch; stale async results must not reopen the dropdown. */
  const suggestGenerationRef = useRef(0)

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
    setSuggestions(hasAny ? data : null)
    if (!hasAny) {
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
    if (disableSuggest) return
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
  }, [value, section, minLength, debounceMs, disableSuggest, autoOpenDropdownOnFetch])

  const listings = suggestions?.listings ?? []
  const listingTitlesLower = new Set(listings.map((l) => l.title.toLowerCase()))
  const extraTitles = (suggestions?.titles ?? []).filter((t) => !listingTitlesLower.has(t.toLowerCase()))

  /** Avoid duplicating brands/categories already shown in the rich strips. */
  const flatSuggestions =
    listings.length > 0
      ? extraTitles.map((t) => ({ type: "title" as const, text: t })).slice(0, SUGGEST_COMBINED_CAP)
      : [
          ...(suggestions?.categories?.map((c) => ({ type: "category" as const, text: c })) ?? []),
          ...(suggestions?.brands?.map((b) => ({ type: "brand" as const, text: b })) ?? []),
          ...extraTitles.map((t) => ({ type: "title" as const, text: t })),
        ].slice(0, SUGGEST_COMBINED_CAP)

  const hasRichStrip =
    !disableSuggest &&
    open &&
    suggestions &&
    (listings.length > 0 || (suggestions.brands?.length ?? 0) > 0 || (suggestions.categories?.length ?? 0) > 0)

  const hasFallbackList = !disableSuggest && open && flatSuggestions.length > 0
  const showDropdown = hasRichStrip || hasFallbackList

  /** When listings share the panel with brands/categories/suggestions, flex so listings scroll instead of clipping the footer. */
  const listingsSharePanelWithFooter =
    listings.length > 0 &&
    ((suggestions?.brands?.length ?? 0) > 0 ||
      (suggestions?.categories?.length ?? 0) > 0 ||
      flatSuggestions.length > 0)

  useEffect(() => {
    if (!showDropdown || !containerRef.current || typeof document === "undefined") {
      setDropdownRect(null)
      return
    }
    const el = containerRef.current
    const update = () => {
      const rect = el.getBoundingClientRect()
      const dropTop = rect.bottom + 8
      let portalTop: number | null = null
      let portalLeft: number | null = null
      if (suggestPortalContainer) {
        const pr = suggestPortalContainer.getBoundingClientRect()
        portalTop = pr.top
        portalLeft = pr.left
      }
      setDropdownRect({
        dropTop,
        anchorLeft: rect.left,
        anchorWidth: rect.width,
        portalTop,
        portalLeft,
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
  }, [showDropdown, suggestPortalContainer])

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

  /** After choosing a link result: kill stale fetches, clear cache, blur so focus doesn’t reopen the menu. */
  const dismissForNavigation = () => {
    invalidatePendingSuggest()
    setOpen(false)
    setSuggestions(null)
    setLoading(false)
    if (inputRef.current && document.activeElement === inputRef.current) inputRef.current.blur()
  }

  const handleSelect = (text: string) => {
    invalidatePendingSuggest()
    onChange(text)
    onSelect?.(text)
    setOpen(false)
    setSuggestions(null)
  }

  const panelLayout =
    dropdownRect && typeof window !== "undefined"
      ? getSuggestPanelLayout({
          top: dropdownRect.dropTop,
          left: dropdownRect.anchorLeft,
          width: dropdownRect.anchorWidth,
        })
      : null

  const portaledInsideModal =
    Boolean(
      suggestPortalContainer &&
        dropdownRect?.portalTop != null &&
        dropdownRect?.portalLeft != null,
    )

  const dropdownPanel =
    showDropdown &&
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
      >
        {listings.length > 0 && (
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
                onClick={(e) => {
                  e.preventDefault()
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
                      onClick={(e) => {
                        e.preventDefault()
                        onNavigate?.()
                        router.push(listingHref(item))
                        dismissForNavigation()
                      }}
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted sm:h-14 sm:w-14 sm:rounded-lg">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
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
              "shrink-0 border-t border-border/60 bg-background",
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
                  <li key={brand} role="option">
                    <button
                      type="button"
                      className="flex w-full cursor-pointer select-none items-center px-3 py-2.5 text-left text-sm outline-none min-h-touch hover:bg-accent/60 focus-visible:bg-accent"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(brand)}
                    >
                      <span className="truncate font-medium text-foreground">{brand}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex gap-3 overflow-x-auto overscroll-x-contain pb-1 pl-0.5 pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [scroll-padding-inline:8px] sm:gap-4 [&::-webkit-scrollbar]:hidden">
                {suggestions!.brands!.map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    className="flex min-w-[4rem] max-w-[4.75rem] flex-col items-center gap-1.5 text-center sm:min-w-[4.5rem] sm:max-w-[5.5rem]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(brand)}
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted text-sm font-bold text-cerulean sm:h-12 sm:w-12 sm:text-base">
                      {brand.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="line-clamp-2 w-full text-[11px] font-medium leading-tight text-foreground sm:text-xs">
                      {brand}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {(suggestions?.categories?.length ?? 0) > 0 && (
          <div className="shrink-0 border-t border-border/60 px-3 py-2.5 sm:px-4 sm:py-3">
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
                  onClick={() => handleSelect(cat)}
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
              "shrink-0 border-t border-border/60",
              listings.length === 0 &&
                (suggestions?.brands?.length ?? 0) === 0 &&
                (suggestions?.categories?.length ?? 0) === 0 &&
                panelTopRounded,
            )}
          >
            <p className="border-b border-border/40 bg-muted/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:px-4 sm:py-2">
              Suggestions
            </p>
            <ul className="max-h-[min(36dvh,240px)] overflow-y-auto overscroll-contain py-1 sm:max-h-[min(40vh,280px)]">
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
                      onClick={() => handleSelect(item.text)}
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
        type="search"
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          onFocusProp?.()
          if (disableSuggest) return
          const q = value.trim()
          if (q.length < minLength) return
          const s = suggestions
          const has =
            (s?.listings?.length ?? 0) > 0 ||
            (s?.titles?.length ?? 0) > 0 ||
            (s?.categories?.length ?? 0) > 0 ||
            (s?.brands?.length ?? 0) > 0
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
        className={cn(
          leftIcon && "pl-10",
          showClear && (loading ? "pr-16" : "pr-10"),
          showClear &&
            "[&::-webkit-search-cancel-button]:hidden [&::-moz-search-clear]:hidden",
          inputClassName,
        )}
        autoComplete="off"
        aria-expanded={showDropdown}
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
            setLoading(false)
          }}
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {dropdownPanel}
      {loading && value.trim().length >= minLength && !disableSuggest && (
        <span
          className={cn(
            "absolute top-1/2 -translate-y-1/2 text-xs text-muted-foreground",
            showClear ? "right-10" : "right-3",
          )}
        >
          …
        </span>
      )}
    </div>
  )
}
