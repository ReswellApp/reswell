"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { IndexBoardModelSelection } from "@/components/index-board-model-combobox"
import {
  getBoardModelsCatalogItems,
  searchBrandsCatalogSuggest,
  type BrandCatalogSuggestRow,
} from "@/app/actions/marketplace"
import { recordSearchSuggestPick } from "@/app/actions/search-suggest-analytics"
import { LISTING_TITLE_MAX_LENGTH } from "@/lib/sell-form-validation"

const BRAND_SUGGEST_DEBOUNCE_MS = 200

/**
 * User finished a full catalog label (typed or picked) and pressed space to keep typing —
 * hide the list until they edit again (uses full local brand name list for exact name detection).
 */
function shouldHideSuggestionsAfterSpacePastExactCatalogLabel(
  value: string,
  catalog: IndexBoardModelSelection[],
): boolean {
  if (!value.endsWith(" ")) return false
  const t = value.trim()
  if (!t) return false
  return catalog.some((o) => o.label.trim() === t)
}

function brandRowToIndexSelection(row: BrandCatalogSuggestRow): IndexBoardModelSelection {
  return {
    brandId: row.id,
    brandSlug: row.slug,
    modelSlug: "",
    brandName: row.name,
    modelName: "",
    label: row.name,
  }
}

/** Title line after choosing a directory model (length is appended on publish, not here). */
export function titleFromIndexModelPick(opt: IndexBoardModelSelection): string {
  return opt.label
}

type SurfboardTitleIndexInputProps = {
  id?: string
  className?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  value: string
  onChange: (value: string) => void
  boardLength: string
  onSelectModel: (opt: IndexBoardModelSelection) => void
  /** When search returns no rows, optional CTA opens the global “request a brand” flow (caller owns the dialog). */
  onRequestBrand?: () => void
}

export function SurfboardTitleIndexInput({
  id,
  className,
  placeholder,
  required,
  disabled,
  value,
  onChange,
  boardLength: _boardLength,
  onSelectModel,
  onRequestBrand,
}: SurfboardTitleIndexInputProps) {
  const [items, setItems] = React.useState<IndexBoardModelSelection[]>([])
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [brandRows, setBrandRows] = React.useState<BrandCatalogSuggestRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [searchSettled, setSearchSettled] = React.useState(false)
  const [open, setOpen] = React.useState(false)
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
  /**
   * Bumped when the query string changes, the field is cleared, or a catalog row is chosen.
   * In-flight fetches compare their snapshot to this so stale responses never clear loading
   * while the latest request is still pending (avoids "Searching brands…" stuck forever).
   */
  const brandSearchEpoch = React.useRef(0)
  /** After a catalog pick, suppress suggestions while the user extends the title (e.g. space + model name). */
  const pickedCatalogTitleRef = React.useRef<string | null>(null)
  const brandSuggestBackendRef = React.useRef<"elasticsearch" | "supabase">("supabase")
  const listId = React.useId()

  const commitCatalogPick = React.useCallback(
    (row: BrandCatalogSuggestRow) => {
      const q = value.trim()
      if (q.length >= 1) {
        void recordSearchSuggestPick({
          surface: "sell_brand_title",
          pickKind: "brand_catalog",
          suggestTrace:
            brandSuggestBackendRef.current === "elasticsearch"
              ? "brand_catalog_elasticsearch"
              : "brand_catalog_supabase",
          queryPrefix: q,
          selectionLabel: row.name,
          listingId: null,
        })
      }
      const opt = brandRowToIndexSelection(row)
      pickedCatalogTitleRef.current = titleFromIndexModelPick(opt).slice(0, LISTING_TITLE_MAX_LENGTH)
      onSelectModel(opt)
      brandSearchEpoch.current += 1
      setLoading(false)
      setOpen(false)
      setDropdownRect(null)
    },
    [onSelectModel, value],
  )

  React.useEffect(() => {
    let cancelled = false
    getBoardModelsCatalogItems()
      .then((data) => {
        if (!cancelled) {
          setItems(Array.isArray(data.items) ? data.items : [])
          setLoadError(null)
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load brands")
      })
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * `searchBrandsCatalogSuggest` uses Elasticsearch (when configured) then hydrates from
   * `public.brands`, else Supabase `ilike` — same pipeline as the brand directory search.
   */
  React.useEffect(() => {
    if (disabled) return
    const q = value.trim()
    if (q.length < 1) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      brandSearchEpoch.current += 1
      setBrandRows([])
      setLoading(false)
      setSearchSettled(false)
      return
    }

    brandSearchEpoch.current += 1
    setSearchSettled(false)
    setLoading(true)
    setBrandRows([])
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const myEpoch = brandSearchEpoch.current
      void (async () => {
        try {
          const { rows, meta } = await searchBrandsCatalogSuggest(q)
          if (myEpoch !== brandSearchEpoch.current) return
          brandSuggestBackendRef.current = meta.backend
          setBrandRows(rows)
          setSearchSettled(true)
          if (rows.length === 0) {
            setOpen(true)
            return
          }
          const pick = pickedCatalogTitleRef.current
          if (pick != null && q === pick.trim()) {
            setOpen(false)
            return
          }
          setOpen(true)
        } catch (err) {
          if (myEpoch === brandSearchEpoch.current) {
            setBrandRows([])
            setSearchSettled(true)
            setOpen(false)
            if (process.env.NODE_ENV === "development") {
              console.error("[SurfboardTitleIndexInput] searchBrandsCatalogSuggest failed:", err)
            }
          }
        } finally {
          if (myEpoch === brandSearchEpoch.current) {
            setLoading(false)
          }
        }
      })()
    }, BRAND_SUGGEST_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [value, disabled])

  React.useEffect(() => {
    setHighlight(0)
  }, [value, brandRows.length])

  const hideSuggestionsAfterExactLabelPlusSpace = React.useMemo(
    () => shouldHideSuggestionsAfterSpacePastExactCatalogLabel(value, items),
    [value, items],
  )

  const q = value.trim()

  /** Panel visible while loading, when we have rows, or after a search returned nothing (so users get feedback). */
  const showDropdown =
    open &&
    !hideSuggestionsAfterExactLabelPlusSpace &&
    q.length >= 1 &&
    (loading || brandRows.length > 0 || (searchSettled && !loading && brandRows.length === 0))

  const showResultsList = !loading && brandRows.length > 0
  const showSearching = loading && brandRows.length === 0
  const showNoMatches =
    searchSettled && !loading && brandRows.length === 0

  /** Position the portaled menu under the input (escapes form/card overflow). */
  React.useEffect(() => {
    if (!showDropdown || !containerRef.current || typeof document === "undefined") {
      setDropdownRect(null)
      return
    }
    const el = containerRef.current
    const update = () => {
      const rect = el.getBoundingClientRect()
      setDropdownRect({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      })
    }
    update()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [showDropdown, value, brandRows.length, loading])

  React.useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (containerRef.current?.contains(t)) return
      if (dropdownRef.current?.contains(t)) return
      setOpen(false)
      setDropdownRect(null)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const panelWidth = dropdownRect
    ? Math.min(Math.max(dropdownRect.width, 280), 520)
    : 360
  const panelLeft = dropdownRect
    ? Math.min(
        dropdownRect.left,
        typeof window !== "undefined" ? window.innerWidth - panelWidth - 16 : dropdownRect.left,
      )
    : 0

  const dropdownPortal =
    showDropdown && dropdownRect && typeof document !== "undefined"
      ? createPortal(
      <div
        ref={dropdownRef}
        id={listId}
        role="listbox"
        aria-label="Brand directory matches"
        className="fixed z-[200] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md"
        style={{
          top: dropdownRect.top,
          left: panelLeft,
          width: panelWidth,
          maxHeight: "min(50vh, 360px)",
        }}
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/20 px-3 py-2">
          <span className="text-xs font-semibold tracking-tight text-foreground sm:text-sm">
            Brands
          </span>
        </div>
        {showSearching ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">Searching brands…</div>
        ) : showNoMatches && !showResultsList ? (
          <div className="px-3 py-4 text-sm">
            <p className="text-muted-foreground">
              No brand profile in the directory matches that search. You can still type a brand name
              above — it doesn’t have to be in the list.
            </p>
            {onRequestBrand ? (
              <Button
                type="button"
                variant="secondary"
                className="mt-3 w-full min-h-touch"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setOpen(false)
                  setDropdownRect(null)
                  onRequestBrand()
                }}
              >
                Request we add this brand
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="max-h-[min(45dvh,320px)] overflow-y-auto overscroll-contain py-1">
            {brandRows.map((item, i) => {
              const lineMeta = [item.location_label, item.lead_shaper_name]
                .map((s) => (typeof s === "string" ? s.trim() : ""))
                .filter(Boolean)
                .join(" · ")
              const desc = item.short_description?.trim()
              const meta =
                lineMeta ||
                (desc ? (desc.length > 120 ? `${desc.slice(0, 117)}…` : desc) : "Brand profile")
              return (
                <li key={item.id} role="option">
                  <button
                    type="button"
                    className={cn(
                      "mx-1 flex w-[calc(100%-0.5rem)] cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-2 text-left text-sm outline-none min-h-touch transition-colors sm:gap-3 sm:rounded-xl sm:py-2.5",
                      i === highlight ? "bg-muted/90" : "hover:bg-muted/80",
                    )}
                    aria-selected={i === highlight}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(ev) => {
                      ev.preventDefault()
                      commitCatalogPick(item)
                    }}
                  >
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted sm:h-12 sm:w-12 sm:rounded-lg">
                      {item.logo_url ? (
                        <Image
                          src={item.logo_url}
                          alt=""
                          fill
                          className="object-contain p-1"
                          sizes="(max-width:640px) 40px, 48px"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-cerulean sm:text-sm">
                          {item.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                        {item.name}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground sm:text-xs">
                        {meta}
                      </p>
                    </div>
                    <SlidersHorizontal className="h-4 w-4 shrink-0 self-center text-muted-foreground/80" aria-hidden />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>,
          document.body,
        )
      : null

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        id={id}
        className={cn("placeholder:text-muted-foreground/45", loading && q.length >= 1 && "pr-8", className)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        value={value}
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls={showDropdown ? listId : undefined}
        autoComplete="off"
        onChange={(e) => {
          const next = e.target.value
          onChange(next)
          const pick = pickedCatalogTitleRef.current
          if (pick != null) {
            if (next.startsWith(pick) && next !== pick) {
              setOpen(false)
              return
            }
            if (!next.startsWith(pick)) {
              pickedCatalogTitleRef.current = null
            }
          }
          if (shouldHideSuggestionsAfterSpacePastExactCatalogLabel(next, items)) {
            setOpen(false)
            return
          }
          if (next.trim().length < 1) {
            setOpen(false)
            return
          }
          setOpen(true)
        }}
        onFocus={() => {
          const pick = pickedCatalogTitleRef.current
          if (pick != null && value.trim() === pick.trim()) {
            return
          }
          if (pick != null && value.startsWith(pick) && value !== pick) {
            return
          }
          if (shouldHideSuggestionsAfterSpacePastExactCatalogLabel(value, items)) {
            return
          }
          if (value.trim().length >= 1) {
            setOpen(true)
          }
        }}
        onKeyDown={(e) => {
          if (!showResultsList || brandRows.length === 0) {
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
            setHighlight((h) => Math.min(h + 1, brandRows.length - 1))
            return
          }
          if (e.key === "ArrowUp") {
            e.preventDefault()
            setHighlight((h) => Math.max(h - 1, 0))
            return
          }
          if (e.key === "Enter") {
            e.preventDefault()
            const row = brandRows[highlight]
            if (row) commitCatalogPick(row)
          }
        }}
      />
      {loading && q.length >= 1 ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          …
        </span>
      ) : null}
      {dropdownPortal}
      {loadError && items.length === 0 ? (
        <p className="text-xs text-muted-foreground/45 mt-1.5" role="status">
          {loadError}
        </p>
      ) : null}
    </div>
  )
}
