"use client"

import * as React from "react"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SiteSearchShell, siteSearchInputClassName } from "@/components/site-search-bar"
import {
  searchBoardTalkReviewBrandsAction,
  searchBoardTalkReviewModelsForBrandAction,
} from "@/app/actions/board-talk-reviews"
import { cn } from "@/lib/utils"

const DEBOUNCE_MS = 200
const BRAND_MIN_QUERY = 1
const MODEL_MIN_QUERY = 0

export type BoardTalkReviewCatalogSelection = {
  brandSlug: string | null
  brandName: string | null
  modelSlug: string | null
  modelName: string | null
}

type SuggestOption = {
  key: string
  label: string
  sublabel?: string
  brandSlug?: string
  modelSlug?: string
}

type CatalogSuggestFieldProps = {
  fieldId: string
  label: string
  placeholder: string
  ariaLabel: string
  value: string
  disabled?: boolean
  minQueryLength: number
  emptyQueryLoads?: boolean
  listHeading: string
  listHint: string
  emptyMessage: string
  onValueChange: (next: string) => void
  onClear: () => void
  fetchOptions: (query: string) => Promise<SuggestOption[]>
  onSelect: (option: SuggestOption) => void
  onOpenChange?: (open: boolean) => void
}

function CatalogSuggestField({
  fieldId,
  label,
  placeholder,
  ariaLabel,
  value,
  disabled = false,
  minQueryLength,
  emptyQueryLoads = false,
  listHeading,
  listHint,
  emptyMessage,
  onValueChange,
  onClear,
  fetchOptions,
  onSelect,
  onOpenChange,
}: CatalogSuggestFieldProps) {
  const [open, setOpen] = React.useState(false)
  const [options, setOptions] = React.useState<SuggestOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [highlight, setHighlight] = React.useState(0)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const generationRef = React.useRef(0)

  const listId = React.useId()
  const q = value.trim()
  const canSearch = emptyQueryLoads || q.length >= minQueryLength
  const hasResults = options.length > 0
  const showDropdown = open && !disabled && canSearch && (loading || hasResults || q.length >= minQueryLength)

  React.useEffect(() => {
    onOpenChange?.(showDropdown)
  }, [onOpenChange, showDropdown])

  React.useEffect(() => {
    setHighlight(0)
  }, [options])

  const invalidatePending = React.useCallback(() => {
    generationRef.current += 1
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  React.useEffect(() => {
    if (disabled) {
      invalidatePending()
      setOptions([])
      setLoading(false)
      setOpen(false)
      return
    }

    if (!canSearch) {
      invalidatePending()
      setOptions([])
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
          const next = await fetchOptions(q)
          if (gen !== generationRef.current) return
          setOptions(next)
          const isFocused =
            Boolean(inputRef.current && document.activeElement === inputRef.current)
          setOpen(isFocused && (next.length > 0 || q.length >= minQueryLength))
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
  }, [canSearch, disabled, fetchOptions, invalidatePending, minQueryLength, q])

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (containerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleSelect(option: SuggestOption) {
    invalidatePending()
    setOpen(false)
    onSelect(option)
  }

  function handleInputChange(next: string) {
    onValueChange(next)
    if (next.trim().length >= minQueryLength || emptyQueryLoads) {
      setOpen(true)
    }
  }

  const dropdownPanel = showDropdown ? (
    <div
      id={listId}
      role="listbox"
      aria-label={ariaLabel}
      className="absolute left-0 right-0 top-full z-[250] mt-2 overflow-hidden rounded-2xl border border-border/80 bg-popover text-popover-foreground shadow-xl shadow-black/10"
      style={{ maxHeight: "min(50vh, 360px)" }}
    >
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {listHeading}
        </p>
        <p className="text-xs text-muted-foreground">{listHint}</p>
      </div>
      {loading && !hasResults ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Searching…</div>
      ) : hasResults ? (
        <ul className="max-h-[min(44vh,320px)] overflow-y-auto py-1">
          {options.map((option, index) => (
            <li key={option.key} role="none">
              <button
                type="button"
                role="option"
                aria-selected={index === highlight}
                className={cn(
                  "flex w-full cursor-pointer select-none flex-col gap-0.5 px-4 py-2.5 text-left text-sm outline-none min-h-touch transition-colors hover:bg-muted/80",
                  index === highlight && "bg-muted/80",
                )}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  handleSelect(option)
                }}
              >
                <span className="truncate font-semibold text-foreground">{option.label}</span>
                {option.sublabel ? (
                  <span className="truncate text-xs text-muted-foreground">{option.sublabel}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</div>
      )}
    </div>
  ) : null

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>{label}</Label>
      <div
        ref={containerRef}
        className={cn("relative w-full min-w-0", open && "z-[250]")}
      >
        <SiteSearchShell actionSlot={null}>
          <Input
            ref={inputRef}
            id={fieldId}
            type="search"
            value={value}
            disabled={disabled}
            onChange={(event) => handleInputChange(event.target.value)}
            onFocus={() => {
              if (!disabled && canSearch) setOpen(true)
            }}
            onKeyDown={(event) => {
              if (!open || options.length === 0) return
              if (event.key === "ArrowDown") {
                event.preventDefault()
                setHighlight((prev) => (prev + 1) % options.length)
              } else if (event.key === "ArrowUp") {
                event.preventDefault()
                setHighlight((prev) => (prev - 1 + options.length) % options.length)
              } else if (event.key === "Enter") {
                event.preventDefault()
                const option = options[highlight]
                if (option) handleSelect(option)
              } else if (event.key === "Escape") {
                setOpen(false)
              }
            }}
            placeholder={placeholder}
            aria-label={ariaLabel}
            aria-expanded={showDropdown}
            aria-controls={showDropdown ? listId : undefined}
            aria-autocomplete="list"
            role="combobox"
            autoComplete="off"
            className={cn(
              siteSearchInputClassName({ compact: true }),
              value && "pr-10",
              value && "[&::-webkit-search-cancel-button]:hidden [&::-moz-search-clear]:hidden",
            )}
          />
          {value ? (
            <button
              type="button"
              aria-label={`Clear ${label.toLowerCase()}`}
              className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                invalidatePending()
                setOpen(false)
                onClear()
                inputRef.current?.focus()
              }}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </SiteSearchShell>
        {dropdownPanel}
      </div>
    </div>
  )
}

type BoardTalkReviewCatalogPickerProps = {
  selection: BoardTalkReviewCatalogSelection
  onSelectionChange: (next: BoardTalkReviewCatalogSelection) => void
}

export function BoardTalkReviewCatalogPicker({
  selection,
  onSelectionChange,
}: BoardTalkReviewCatalogPickerProps) {
  const [brandQuery, setBrandQuery] = React.useState("")
  const [modelQuery, setModelQuery] = React.useState("")
  const [brandDropdownOpen, setBrandDropdownOpen] = React.useState(false)
  const [modelDropdownOpen, setModelDropdownOpen] = React.useState(false)
  const anyDropdownOpen = brandDropdownOpen || modelDropdownOpen

  const fetchBrandOptions = React.useCallback(async (query: string) => {
    const rows = await searchBoardTalkReviewBrandsAction(query)
    return rows.map((row) => ({
      key: row.id,
      label: row.name,
      brandSlug: row.slug,
    }))
  }, [])

  const fetchModelOptions = React.useCallback(
    async (query: string) => {
      if (!selection.brandSlug) return []
      const rows = await searchBoardTalkReviewModelsForBrandAction(selection.brandSlug, query)
      return rows.map((row) => ({
        key: row.id,
        label: row.name,
        modelSlug: row.modelSlug,
      }))
    },
    [selection.brandSlug],
  )

  function handleBrandValueChange(next: string) {
    setBrandQuery(next)
    if (selection.brandSlug || selection.brandName) {
      onSelectionChange({
        brandSlug: null,
        brandName: null,
        modelSlug: null,
        modelName: null,
      })
      setModelQuery("")
    }
  }

  function handleModelValueChange(next: string) {
    setModelQuery(next)
    if (selection.modelSlug || selection.modelName) {
      onSelectionChange({
        brandSlug: selection.brandSlug,
        brandName: selection.brandName,
        modelSlug: null,
        modelName: null,
      })
    }
  }

  return (
    <div className={cn("relative space-y-4", anyDropdownOpen && "z-[250]")}>
      <CatalogSuggestField
        fieldId="board-review-brand"
        label="Brand"
        placeholder="Search brands…"
        ariaLabel="Search brands"
        value={brandQuery}
        minQueryLength={BRAND_MIN_QUERY}
        listHeading="Brands"
        listHint="Pick a brand"
        emptyMessage="No brands match your search."
        onOpenChange={setBrandDropdownOpen}
        onValueChange={handleBrandValueChange}
        onClear={() => {
          setBrandQuery("")
          setModelQuery("")
          onSelectionChange({
            brandSlug: null,
            brandName: null,
            modelSlug: null,
            modelName: null,
          })
        }}
        fetchOptions={fetchBrandOptions}
        onSelect={(option) => {
          if (!option.brandSlug) return
          setBrandQuery(option.label)
          setModelQuery("")
          onSelectionChange({
            brandSlug: option.brandSlug,
            brandName: option.label,
            modelSlug: null,
            modelName: null,
          })
        }}
      />

      <CatalogSuggestField
        fieldId="board-review-model"
        label="Model"
        placeholder={selection.brandSlug ? "Search models…" : "Select a brand first"}
        ariaLabel="Search models"
        value={modelQuery}
        disabled={!selection.brandSlug}
        minQueryLength={MODEL_MIN_QUERY}
        emptyQueryLoads
        onOpenChange={setModelDropdownOpen}
        listHeading="Models"
        listHint={selection.brandName ? selection.brandName : "Pick a model"}
        emptyMessage={
          selection.brandSlug
            ? "No models match your search."
            : "Select a brand to browse models."
        }
        onValueChange={handleModelValueChange}
        onClear={() => {
          setModelQuery("")
          onSelectionChange({
            brandSlug: selection.brandSlug,
            brandName: selection.brandName,
            modelSlug: null,
            modelName: null,
          })
        }}
        fetchOptions={fetchModelOptions}
        onSelect={(option) => {
          if (!option.modelSlug) return
          setModelQuery(option.label)
          onSelectionChange({
            brandSlug: selection.brandSlug,
            brandName: selection.brandName,
            modelSlug: option.modelSlug,
            modelName: option.label,
          })
        }}
      />
    </div>
  )
}
