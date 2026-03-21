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

/** Max rows in the combined Suggestions list (titles / categories / brands). */
const SUGGEST_COMBINED_CAP = 24

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
  /** "used" | "surfboards" to scope suggestions */
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
}

function listingHref(listing: SuggestListing) {
  const id = listing.slug || listing.id
  return listing.section === "surfboards" ? `/boards/${id}` : `/used/${id}`
}

function listingSectionLabel(section: string) {
  if (section === "surfboards") return "Surfboard"
  if (section === "used") return "Used gear"
  return "Listing"
}

async function fetchSearchSuggestionsJson(
  q: string,
  section: string,
): Promise<{ data: SuggestResult; hasAny: boolean }> {
  const params = new URLSearchParams({ q })
  if (section) params.set("section", section)
  const res = await fetch(`/api/search/suggest?${params.toString()}`)
  const data: SuggestResult = await res.json()
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
}: SearchInputWithSuggestProps) {
  const [suggestions, setSuggestions] = useState<SuggestResult | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
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

  useEffect(() => {
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

  const panelWidth = dropdownRect
    ? Math.min(Math.max(dropdownRect.width, 400), 520)
    : 400
  const panelLeft = dropdownRect
    ? Math.min(dropdownRect.left, typeof window !== "undefined" ? window.innerWidth - panelWidth - 16 : dropdownRect.left)
    : 0

  const dropdownPanel =
    showDropdown &&
    dropdownRect &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={dropdownRef}
        id={listboxId}
        role="listbox"
        className={cn(
          "fixed z-[100] overflow-hidden rounded-2xl border border-border/80 bg-popover text-popover-foreground",
          "shadow-xl shadow-black/10",
        )}
        style={{
          top: dropdownRect.top,
          left: panelLeft,
          width: panelWidth,
          maxHeight: "min(70vh, 520px)",
        }}
      >
        {listings.length > 0 && (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-2.5">
              <span className="text-sm font-semibold tracking-tight text-foreground">Top listings</span>
              <Link
                href={`/search?q=${encodeURIComponent(value.trim())}`}
                className="shrink-0 text-sm font-medium text-cerulean hover:text-pacific hover:underline"
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
            <ul className="max-h-[min(45vh,360px)] overflow-y-auto py-1">
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
                      className="mx-1 flex gap-3 rounded-xl px-2 py-2.5 outline-none transition-colors hover:bg-muted/80 focus-visible:bg-muted/80"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.preventDefault()
                        onNavigate?.()
                        router.push(listingHref(item))
                        dismissForNavigation()
                      }}
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="56px"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                            No photo
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 font-semibold leading-snug text-foreground">
                          {capitalizeWords(item.title)}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{meta}</p>
                        <p className="mt-1 text-sm font-semibold text-cerulean">
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
          </>
        )}

        {(suggestions?.brands?.length ?? 0) > 0 && (
          <div
            className={cn(
              "border-t border-border/60 bg-background px-4 py-3",
              listings.length === 0 && "rounded-t-2xl",
            )}
          >
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Brands
            </p>
            <div className="flex gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {suggestions!.brands!.map((brand) => (
                <button
                  key={brand}
                  type="button"
                  className="flex min-w-[4.5rem] max-w-[5.5rem] flex-col items-center gap-1.5 text-center"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(brand)}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted text-base font-bold text-cerulean">
                    {brand.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="line-clamp-2 w-full text-xs font-medium leading-tight text-foreground">
                    {brand}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {(suggestions?.categories?.length ?? 0) > 0 && (
          <div className="border-t border-border/60 px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Categories
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions!.categories!.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-cerulean/30"
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
              "border-t border-border/60",
              listings.length === 0 &&
                (suggestions?.brands?.length ?? 0) === 0 &&
                (suggestions?.categories?.length ?? 0) === 0 &&
                "rounded-t-2xl",
            )}
          >
            <p className="border-b border-border/40 bg-muted/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Suggestions
            </p>
            <ul className="max-h-[min(40vh,280px)] overflow-y-auto py-1">
              {flatSuggestions.map((item, i) => {
                const Icon = item.type === "category" ? Tag : item.type === "brand" ? Package : Type
                return (
                  <li key={`${item.type}-${item.text}-${i}`} role="option">
                    <button
                      type="button"
                      className="mx-1 flex w-[calc(100%-0.5rem)] cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-muted/80 focus-visible:bg-muted/80"
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
      document.body,
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
