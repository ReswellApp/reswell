"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { MapPin, Store, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  SiteSearchFormSubmitButton,
  SiteSearchShell,
  siteSearchInputClassName,
} from "@/components/site-search-bar"
import { cn } from "@/lib/utils"
import { VerifiedBadge } from "@/components/verified-badge"
import {
  searchSellersCatalogSuggest,
  type SellerSuggestRow,
} from "@/app/actions/sellers"

const DEBOUNCE_MS = 200
const MIN_QUERY_LENGTH = 1

type SellersDirectorySearchProps = {
  defaultValue?: string
  className?: string
  placeholder?: string
}

function sellerLabel(row: SellerSuggestRow): string {
  return row.shop_name?.trim() || row.display_name?.trim() || "Seller"
}

function sellerLocationLabel(row: SellerSuggestRow): string | null {
  const addr = row.shop_address?.trim()
  if (addr) return addr
  const city = row.city?.trim()
  return city || null
}

/**
 * `/sellers` directory typeahead. Elasticsearch-backed when configured, with a Supabase
 * `ilike` fallback. Only surfaces seller/shop profiles — never listings or other entities.
 *
 * Clicking a suggestion navigates to the shop profile. Pressing Enter or the Search button
 * submits as a GET to `/sellers?q=…` so the existing SSR list fallback still works.
 */
export function SellersDirectorySearch({
  defaultValue = "",
  className,
  placeholder = "Search sellers by name, shop, or city…",
}: SellersDirectorySearchProps) {
  const router = useRouter()
  const [value, setValue] = React.useState(defaultValue)
  const [open, setOpen] = React.useState(false)
  const [rows, setRows] = React.useState<SellerSuggestRow[] | null>(null)
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
  /** Bumps when user dismisses or starts a new fetch; stale async results must not reopen the dropdown. */
  const generationRef = React.useRef(0)

  const listId = React.useId()
  const q = value.trim()
  const hasRows = (rows?.length ?? 0) > 0
  const showDropdown = open && hasRows

  React.useEffect(() => {
    setHighlight(0)
  }, [rows])

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
      setRows(null)
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
          const results = await searchSellersCatalogSuggest(q)
          if (gen !== generationRef.current) return
          setRows(results)
          if (results.length === 0) {
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

  const goToSeller = React.useCallback(
    (slug: string) => {
      if (!slug) return
      invalidatePending()
      setOpen(false)
      router.push(`/sellers/${encodeURIComponent(slug)}`)
    },
    [router, invalidatePending],
  )

  const submitDirectorySearch = React.useCallback(
    (term: string) => {
      invalidatePending()
      setOpen(false)
      const t = term.trim()
      if (!t) {
        router.push("/sellers")
        return
      }
      router.push(`/sellers?q=${encodeURIComponent(t)}`)
    },
    [router, invalidatePending],
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    submitDirectorySearch(value)
  }

  const panelWidth = dropdownRect
    ? Math.min(Math.max(dropdownRect.width, 320), 520)
    : 400
  const panelLeft = dropdownRect
    ? Math.min(
        dropdownRect.left,
        typeof window !== "undefined"
          ? window.innerWidth - panelWidth - 16
          : dropdownRect.left,
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
        aria-label="Seller directory matches"
        className="fixed z-[100] overflow-hidden rounded-2xl border border-border/80 bg-popover text-popover-foreground shadow-xl shadow-black/10"
        style={{
          top: dropdownRect.top,
          left: panelLeft,
          width: panelWidth,
          maxHeight: "min(55vh, 420px)",
        }}
      >
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Sellers
          </p>
          <p className="text-xs text-muted-foreground">
            Press Enter to search all results
          </p>
        </div>
        <ul className="max-h-[min(45vh,340px)] overflow-y-auto py-1">
          {rows!.map((row, i) => {
            const label = sellerLabel(row)
            const location = sellerLocationLabel(row)
            const avatar = row.shop_logo_url || row.avatar_url || null
            return (
              <li key={row.id} role="none">
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
                    goToSeller(row.seller_slug)
                  }}
                >
                  {avatar ? (
                    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border/60 bg-background">
                      <Image
                        src={avatar}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="40px"
                        unoptimized
                      />
                    </span>
                  ) : (
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted text-sm font-semibold text-cerulean"
                      aria-hidden
                    >
                      {label.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate font-semibold text-foreground">
                        {label}
                      </span>
                      {row.shop_verified ? <VerifiedBadge size="sm" /> : null}
                    </div>
                    {location ? (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate">{location}</span>
                      </p>
                    ) : null}
                  </div>
                  <Store
                    className="h-4 w-4 shrink-0 self-center text-muted-foreground/80"
                    aria-hidden
                  />
                </button>
              </li>
            )
          })}
        </ul>
      </div>,
      document.body,
    )

  const showClear = value.length > 0

  return (
    <div className={cn("w-full", className)} ref={containerRef}>
      <form onSubmit={handleSubmit}>
        <SiteSearchShell
          actionSlot={
            <SiteSearchFormSubmitButton
              type="submit"
              aria-label="Search sellers directory"
            >
              Search
            </SiteSearchFormSubmitButton>
          }
        >
          <Input
            ref={inputRef}
            type="search"
            name="q"
            enterKeyHint="search"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              if (e.target.value.trim().length >= MIN_QUERY_LENGTH) setOpen(true)
            }}
            onFocus={() => {
              if (hasRows && q.length >= MIN_QUERY_LENGTH) setOpen(true)
            }}
            onKeyDown={(e) => {
              if (!showDropdown || !hasRows) {
                if (e.key === "Escape") setOpen(false)
                return
              }
              if (e.key === "Escape") {
                e.preventDefault()
                setOpen(false)
                return
              }
              if (e.key === "ArrowDown") {
                e.preventDefault()
                setHighlight((h) => Math.min(h + 1, (rows?.length ?? 1) - 1))
                return
              }
              if (e.key === "ArrowUp") {
                e.preventDefault()
                setHighlight((h) => Math.max(h - 1, 0))
                return
              }
              if (e.key === "Enter") {
                const row = rows?.[highlight]
                if (row?.seller_slug) {
                  e.preventDefault()
                  goToSeller(row.seller_slug)
                }
              }
            }}
            placeholder={placeholder}
            aria-label="Search sellers"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls={showDropdown ? listId : undefined}
            autoComplete="off"
            className={cn(
              siteSearchInputClassName(),
              showClear && "pr-10",
              showClear &&
                "[&::-webkit-search-cancel-button]:hidden [&::-moz-search-clear]:hidden",
            )}
          />
          {showClear ? (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                invalidatePending()
                setValue("")
                setRows(null)
                setOpen(false)
              }}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          {loading && q.length >= MIN_QUERY_LENGTH ? (
            <span
              className={cn(
                "absolute top-1/2 -translate-y-1/2 text-xs text-muted-foreground",
                showClear ? "right-10" : "right-3",
              )}
              aria-hidden
            >
              …
            </span>
          ) : null}
        </SiteSearchShell>
      </form>
      {dropdownPanel}
    </div>
  )
}
