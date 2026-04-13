"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { IndexBoardModelSelection } from "@/components/index-board-model-combobox"
import { getBoardModelsCatalogItems } from "@/app/actions/marketplace"
import { LISTING_TITLE_MAX_LENGTH } from "@/lib/sell-form-validation"

/**
 * User finished a full catalog label (typed or picked) and pressed space to keep typing —
 * trimmed query still matches via substring filter, so we hide the list until they edit again.
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

function filterIndexBoardModels(
  items: IndexBoardModelSelection[],
  query: string,
  limit = 40,
): IndexBoardModelSelection[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return items
    .filter((o) => {
      const hay =
        `${o.label} ${o.brandName} ${o.modelName} ${o.brandSlug} ${o.modelSlug} ${o.brandId}`.toLowerCase()
      return hay.includes(q)
    })
    .slice(0, limit)
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
  boardLength,
  onSelectModel,
}: SurfboardTitleIndexInputProps) {
  const [items, setItems] = React.useState<IndexBoardModelSelection[]>([])
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)
  const [highlight, setHighlight] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  /** After a catalog pick, suppress suggestions while the user extends the title (e.g. space + model name). */
  const pickedCatalogTitleRef = React.useRef<string | null>(null)
  const listId = React.useId()

  const commitCatalogPick = React.useCallback(
    (opt: IndexBoardModelSelection) => {
      pickedCatalogTitleRef.current = titleFromIndexModelPick(opt).slice(0, LISTING_TITLE_MAX_LENGTH)
      onSelectModel(opt)
      setOpen(false)
    },
    [onSelectModel],
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

  const hideSuggestionsAfterExactLabelPlusSpace = React.useMemo(
    () => shouldHideSuggestionsAfterSpacePastExactCatalogLabel(value, items),
    [value, items],
  )

  const showList =
    open &&
    !hideSuggestionsAfterExactLabelPlusSpace &&
    (loadError != null && items.length === 0 ? true : items.length > 0) &&
    filtered.length > 0

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
          setOpen(true)
        }}
        onFocus={() => {
          const pick = pickedCatalogTitleRef.current
          if (pick != null && value.startsWith(pick) && value !== pick) {
            return
          }
          if (shouldHideSuggestionsAfterSpacePastExactCatalogLabel(value, items)) {
            return
          }
          setOpen(true)
        }}
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
            if (opt) commitCatalogPick(opt)
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
          ) : (
            filtered.map((opt, i) => (
              <button
                key={`${opt.brandId}/${opt.modelSlug}`}
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
                  commitCatalogPick(opt)
                }}
              >
                <span className="truncate">{opt.label}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground mt-1.5">
        Search and pick a board from our directory to link brand and model. Or set brand in the next section — including
        requesting a new directory entry there.
      </p>
    </div>
  )
}
