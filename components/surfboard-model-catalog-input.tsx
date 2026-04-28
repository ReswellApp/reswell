"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { SellBrandModelCatalogRow } from "@/app/actions/marketplace"
import { LISTING_BOARD_MODEL_MAX_LENGTH } from "@/lib/sell-form-validation"

function filterCatalogModels(rows: SellBrandModelCatalogRow[], query: string): SellBrandModelCatalogRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows.slice(0, 120)
  return rows.filter((m) => m.name.toLowerCase().includes(q))
}

export type SurfboardModelCatalogInputProps = {
  id?: string
  className?: string
  placeholder?: string
  disabled?: boolean
  value: string
  onFreeTextChange: (next: string) => void
  onPickCatalogRow: (row: SellBrandModelCatalogRow) => void
  models: SellBrandModelCatalogRow[]
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
  value,
  onFreeTextChange,
  onPickCatalogRow,
  models,
}: SurfboardModelCatalogInputProps) {
  const [open, setOpen] = React.useState(false)
  const [highlight, setHighlight] = React.useState(0)
  const [dropdownRect, setDropdownRect] = React.useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const listId = React.useId()

  const catalogActive = Boolean(models.length && !disabled)

  const q = value.trim()
  const filtered = React.useMemo(
    () => (catalogActive ? filterCatalogModels(models, value) : []),
    [catalogActive, models, value],
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

  const portalVisible = open && catalogActive && q.length >= 1

  React.useEffect(() => {
    if (!portalVisible || !containerRef.current || typeof document === "undefined") {
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
  }, [portalVisible, value, filtered.length])

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

  const showResultsList = filtered.length > 0

  const dropdownPortal =
    portalVisible &&
    dropdownRect &&
    catalogActive &&
    typeof document !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            id={listId}
            role="listbox"
            aria-label="Catalog models for this brand"
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
                Models
              </span>
            </div>
            {showResultsList ? (
              <ul className="max-h-[min(45dvh,320px)] overflow-y-auto overscroll-contain py-1">
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
                      <span className="font-medium">{row.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-3 py-4 text-sm text-muted-foreground">
                No catalog model matches &quot;{q}&quot;. Keep typing — your text stays on the listing; or choose
                Request below.
              </div>
            )}
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        className={cn("placeholder:text-muted-foreground/45", className)}
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        maxLength={LISTING_BOARD_MODEL_MAX_LENGTH}
        aria-autocomplete="list"
        aria-expanded={Boolean(portalVisible && dropdownRect)}
        aria-controls={portalVisible && dropdownRect ? listId : undefined}
        autoComplete="off"
        onChange={(e) => {
          onFreeTextChange(e.target.value)
          if (catalogActive) setOpen(true)
        }}
        onFocus={() => {
          if (catalogActive && value.trim().length >= 1) setOpen(true)
        }}
        onKeyDown={(e) => {
          if (!catalogActive) {
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
      {dropdownPortal}
    </div>
  )
}
