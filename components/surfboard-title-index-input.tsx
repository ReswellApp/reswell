"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { IndexBoardModelSelection } from "@/components/index-board-model-combobox"

function filterIndexBoardModels(
  items: IndexBoardModelSelection[],
  query: string,
  limit = 40,
): IndexBoardModelSelection[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return items
    .filter((o) => {
      const hay = `${o.label} ${o.brandName} ${o.modelName} ${o.brandSlug} ${o.modelSlug}`.toLowerCase()
      return hay.includes(q)
    })
    .slice(0, limit)
}

/** Title line after choosing a directory model; appends board length when present. */
export function titleFromIndexModelPick(
  opt: IndexBoardModelSelection,
  boardLength: string,
): string {
  const len = boardLength.trim()
  return len ? `${opt.label} - ${len}` : opt.label
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
  boardLength,
  onSelectModel,
}: SurfboardTitleIndexInputProps) {
  const [items, setItems] = React.useState<IndexBoardModelSelection[]>([])
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)
  const [highlight, setHighlight] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const listId = React.useId()

  React.useEffect(() => {
    let cancelled = false
    fetch("/api/brands/board-models")
      .then((r) => {
        if (!r.ok) throw new Error("bad response")
        return r.json()
      })
      .then((data: { items: IndexBoardModelSelection[] }) => {
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

  const filtered = React.useMemo(
    () => filterIndexBoardModels(items, value),
    [items, value],
  )

  React.useEffect(() => {
    setHighlight(0)
  }, [value, filtered.length])

  React.useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const el = containerRef.current
      if (el && !el.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const showList =
    open && value.trim().length > 0 && (loadError != null && items.length === 0 ? true : items.length > 0)

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        className={cn(className)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        value={value}
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showList || filtered.length === 0) {
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
            const opt = filtered[highlight]
            if (opt) {
              onSelectModel(opt)
              setOpen(false)
            }
          }
        }}
      />
      {showList ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-[min(320px,50vh)] w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {loadError && items.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">{loadError}</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No matching brand.</div>
          ) : (
            filtered.map((opt, i) => (
              <button
                key={`${opt.brandSlug}/${opt.modelSlug}`}
                type="button"
                role="option"
                aria-selected={i === highlight}
                className={cn(
                  "flex w-full cursor-pointer select-none items-center px-3 py-2.5 text-left text-sm outline-none min-h-touch",
                  i === highlight ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                )}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(ev) => {
                  ev.preventDefault()
                  onSelectModel(opt)
                  setOpen(false)
                }}
              >
                <span className="truncate">{opt.label}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground mt-1.5">
        Start typing to match a brand, then pick a suggestion to link this listing.
      </p>
    </div>
  )
}
