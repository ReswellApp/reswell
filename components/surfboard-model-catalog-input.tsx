"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SELL_CONTROL_CLASS } from "@/components/features/sell/sell-form-surface"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { computeBelowFieldDropdownLayout } from "@/lib/utils/below-field-dropdown-layout"
import type { SellBrandModelCatalogRow } from "@/app/actions/marketplace"
import { LISTING_BOARD_MODEL_MAX_LENGTH } from "@/lib/sell-form-validation"

const MODEL_SUBSTRING_MATCH_MIN_CHARS = 4

/**
 * Prefer token-prefix matches so very short needles (e.g. "and") don't match arbitrary
 * substrings inside unrelated words ("hand", "sand", "island").
 * For longer typed strings, substring search still finds mid-word fragments ("fish" in models).
 */
function filterCatalogModels(rows: SellBrandModelCatalogRow[], query: string): SellBrandModelCatalogRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows.slice(0, 120)

  return rows
    .filter((m) => {
      const name = m.name.toLowerCase()
      const brand = m.brandName.toLowerCase()
      const combo = `${brand} ${name}`
      const tokens = combo.split(/[\s\-'/.]+/).filter(Boolean)
      const tokenHits = tokens.some((t) => t.startsWith(q) || t === q)
      if (tokenHits) return true
      if (q.length >= MODEL_SUBSTRING_MATCH_MIN_CHARS) {
        return name.includes(q) || brand.includes(q) || combo.includes(q)
      }
      return false
    })
    .slice(0, 120)
}

export type SurfboardModelCatalogInputProps = {
  id?: string
  className?: string
  placeholder?: string
  disabled?: boolean
  /** After catalog fetch finished successfully (may be zero rows). */
  catalogReady: boolean
  value: string
  onFreeTextChange: (next: string) => void
  onPickCatalogRow: (row: SellBrandModelCatalogRow) => void
  models: SellBrandModelCatalogRow[]
  /** Shown inside the dropdown when there is no catalog match or the catalog is empty. */
  onRequestCatalogAdd?: () => void
  /**
   * When false, no catalog overlay (free-typed brand — global model list is not relevant).
   * Defaults to true.
   */
  catalogSuggestionsEnabled?: boolean
  /**
   * Portal the dropdown to `document.body` (needed inside horizontal overflow filter bars
   * where an in-flow mobile dropdown would be clipped).
   */
  portaledDropdown?: boolean
}

/**
 * Searchable catalog overlay for `/sell` model entry — parallels {@link SurfboardTitleIndexInput}
 * (single field + portaled dropdown, keyboard nav). Catalog matches live in the same control as free text.
 */
export function SurfboardModelCatalogInput({
  id,
  className,
  placeholder,
  disabled,
  catalogReady,
  value,
  onFreeTextChange,
  onPickCatalogRow,
  models,
  onRequestCatalogAdd,
  catalogSuggestionsEnabled = true,
  portaledDropdown = false,
}: SurfboardModelCatalogInputProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  const [highlight, setHighlight] = React.useState(0)
  const [dropdownRect, setDropdownRect] = React.useState<ReturnType<
    typeof computeBelowFieldDropdownLayout
  > | null>(null)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const listId = React.useId()

  const catalogHasRows = models.length > 0
  const canUseSuggest = Boolean(catalogReady && !disabled && catalogSuggestionsEnabled)

  const q = value.trim()
  const filtered = React.useMemo(
    () => (catalogHasRows ? filterCatalogModels(models, value) : []),
    [catalogHasRows, models, value],
  )

  const commitPick = React.useCallback(
    (row: SellBrandModelCatalogRow) => {
      onPickCatalogRow(row)
      setOpen(false)
      setDropdownRect(null)
    },
    [onPickCatalogRow],
  )

  React.useEffect(() => {
    setHighlight((h) => Math.min(h, Math.max(filtered.length - 1, 0)))
  }, [filtered.length])

  const portalVisible = open && canUseSuggest && filtered.length > 0
  /** Fixed portals mis-track the field when the mobile keyboard/visual viewport shifts — anchor in-flow below the input instead. */
  const usePortaledDropdown = portaledDropdown || !isMobile
  const anchoredBelowInputMobile = portalVisible && isMobile && !portaledDropdown
  const portaledSuggestDropdown = portalVisible && usePortaledDropdown

  React.useLayoutEffect(() => {
    if (!portaledSuggestDropdown || !containerRef.current || typeof document === "undefined") {
      setDropdownRect(null)
      return
    }
    const el = containerRef.current
    const update = () => {
      setDropdownRect(computeBelowFieldDropdownLayout(el))
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
  }, [portaledSuggestDropdown, value, filtered.length])

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

  const showResultsList = filtered.length > 0

  const listAreaClassName = cn(
    "overscroll-contain py-1",
    anchoredBelowInputMobile
      ? "min-h-0 flex-1 overflow-y-auto"
      : "max-h-[min(45dvh,320px)] overflow-y-auto",
  )

  const dropdownShellClassName = cn(
    "overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md",
    anchoredBelowInputMobile
      ? "absolute left-0 right-0 top-full z-[400] mt-1 flex max-h-[min(42dvh,280px)] w-full flex-col"
      : "fixed z-[400]",
  )

  const dropdownPanel = (
    <div
      ref={dropdownRef}
      id={listId}
      role="listbox"
      aria-label="Catalog models"
      className={dropdownShellClassName}
      style={
        portaledSuggestDropdown && dropdownRect
          ? {
              top: dropdownRect.top,
              left: dropdownRect.left,
              width: dropdownRect.width,
              maxHeight: dropdownRect.maxHeight,
            }
          : undefined
      }
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/20 px-3 py-2">
        <span className="text-xs font-semibold tracking-tight text-foreground sm:text-sm">Models</span>
      </div>
      {showResultsList ? (
        <ul className={listAreaClassName}>
          {filtered.map((row, i) => (
            <li key={row.id} role="option">
              <button
                type="button"
                className={cn(
                  "mx-1 flex w-[calc(100%-0.5rem)] cursor-pointer select-none items-center rounded-lg px-2 py-2.5 text-left text-sm outline-none min-h-touch transition-colors",
                  i === highlight ? "bg-muted/90" : "hover:bg-muted/80",
                )}
                aria-selected={i === highlight}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(ev) => {
                  ev.preventDefault()
                  commitPick(row)
                }}
              >
                <span className="flex flex-col gap-0.5 text-left">
                  <span className="font-medium leading-tight">{row.name}</span>
                  <span className="text-xs font-normal text-muted-foreground leading-tight">{row.brandName}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-3 px-3 py-4 text-sm text-muted-foreground">
          {catalogHasRows ? <p>No catalog match — your text is still used for the listing.</p> : null}
          {onRequestCatalogAdd ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full min-h-touch"
              onMouseDown={(e) => {
                e.preventDefault()
                setOpen(false)
                setDropdownRect(null)
                onRequestCatalogAdd()
              }}
            >
              Request we add this model
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )

  const dropdownPortal =
    portaledSuggestDropdown && dropdownRect && canUseSuggest && typeof document !== "undefined"
      ? createPortal(dropdownPanel, document.body)
      : null

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        className={cn(
          SELL_CONTROL_CLASS,
          className,
        )}
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        maxLength={LISTING_BOARD_MODEL_MAX_LENGTH}
        aria-autocomplete="list"
        aria-expanded={Boolean(
          (anchoredBelowInputMobile || (portaledSuggestDropdown && dropdownRect)) && canUseSuggest,
        )}
        aria-controls={
          anchoredBelowInputMobile || (portaledSuggestDropdown && dropdownRect) ? listId : undefined
        }
        autoComplete="off"
        onChange={(e) => {
          onFreeTextChange(e.target.value)
          if (canUseSuggest) setOpen(true)
        }}
        onFocus={() => {
          if (canUseSuggest) setOpen(true)
        }}
        onKeyDown={(e) => {
          if (!canUseSuggest) {
            if (e.key === "Escape") setOpen(false)
            return
          }
          if (e.key === "Escape") {
            e.preventDefault()
            setOpen(false)
            return
          }
          if (!showResultsList) {
            return
          }
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setHighlight((h) => Math.min(h + 1, filtered.length - 1))
            return
          }
          if (e.key === "ArrowUp") {
            e.preventDefault()
            setHighlight((h) => Math.max(h - 1, 0))
            return
          }
          if (e.key === "Enter") {
            e.preventDefault()
            const row = filtered[highlight]
            if (row) commitPick(row)
          }
        }}
      />
      {anchoredBelowInputMobile ? dropdownPanel : null}
      {dropdownPortal}
    </div>
  )
}
