"use client"

import * as React from "react"
import Image from "next/image"
import { SlidersHorizontal } from "lucide-react"
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
}: SurfboardTitleIndexInputProps) {
  const [items, setItems] = React.useState<IndexBoardModelSelection[]>([])
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [brandRows, setBrandRows] = React.useState<BrandCatalogSuggestRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [highlight, setHighlight] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestGen = React.useRef(0)
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
      // Invalidate in-flight suggest so a late response cannot call setOpen(true) again.
      suggestGen.current += 1
      setLoading(false)
      setOpen(false)
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

  /** Same search pipeline as Brand / shaper — `searchBrandsCatalogSuggest` (Elasticsearch or Supabase). */
  React.useEffect(() => {
    if (disabled) return
    const q = value.trim()
    if (q.length < 1) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      suggestGen.current += 1
      setBrandRows([])
      setLoading(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const gen = ++suggestGen.current
      setLoading(true)
      void (async () => {
        try {
          const { rows, meta } = await searchBrandsCatalogSuggest(q)
          if (gen !== suggestGen.current) return
          brandSuggestBackendRef.current = meta.backend
          setBrandRows(rows)
          if (rows.length === 0) {
            setOpen(false)
            return
          }
          const pick = pickedCatalogTitleRef.current
          if (pick != null && q === pick.trim()) {
            setOpen(false)
            return
          }
          // Do not require document.activeElement === input — that check fails in some browsers /
          // focus edge cases and blocks the panel after a successful search.
          setOpen(true)
        } catch (err) {
          if (gen === suggestGen.current) {
            setBrandRows([])
            setOpen(false)
            if (process.env.NODE_ENV === "development") {
              console.error("[SurfboardTitleIndexInput] searchBrandsCatalogSuggest failed:", err)
            }
          }
        } finally {
          if (gen === suggestGen.current) setLoading(false)
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

  React.useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const el = containerRef.current
      if (el && !el.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const hideSuggestionsAfterExactLabelPlusSpace = React.useMemo(
    () => shouldHideSuggestionsAfterSpacePastExactCatalogLabel(value, items),
    [value, items],
  )

  const q = value.trim()
  const showList =
    open &&
    !hideSuggestionsAfterExactLabelPlusSpace &&
    !loading &&
    q.length >= 1 &&
    brandRows.length > 0

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
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
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
          if (!showList || brandRows.length === 0) {
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
      {showList ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-[200] mt-1 max-h-[min(50vh,360px)] w-full min-w-0 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md"
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/20 px-3 py-2">
            <span className="text-xs font-semibold tracking-tight text-foreground sm:text-sm">Brands</span>
          </div>
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
                      <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{item.name}</p>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground sm:text-xs">{meta}</p>
                    </div>
                    <SlidersHorizontal className="h-4 w-4 shrink-0 self-center text-muted-foreground/80" aria-hidden />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
      {loadError && items.length === 0 ? (
        <p className="text-xs text-muted-foreground/45 mt-1.5" role="status">
          {loadError}
        </p>
      ) : null}
    </div>
  )
}
