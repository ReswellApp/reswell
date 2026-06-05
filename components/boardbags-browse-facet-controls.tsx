"use client"

import { useEffect, useRef, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  BOARDBAG_CONDITION_OPTIONS,
  BOARDBAG_FACET_PARAM_KEYS,
  type BoardbagFacetOption,
} from "@/lib/boardbags-browse-facets"
import { BOARDBAG_SIZE_OPTIONS } from "@/lib/boardbag-listing-config"
import { cn } from "@/lib/utils"
import type { BoardbagsFilterState } from "@/components/boardbags-browse-filter-state"

const PRICE_MAX_HINT = 5000

type FacetCountsMap = Record<string, Record<string, number>>

type CheckRowProps = {
  checked: boolean
  count: number | undefined
  label: string
  onToggle: () => void
  id: string
}

function CheckRow({ checked, count, label, onToggle, id }: CheckRowProps) {
  const disabled = !checked && (count ?? 0) === 0
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 py-1.5 text-sm",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={() => onToggle()}
        className="shrink-0"
      />
      <span className="min-w-0 flex-1 truncate text-foreground/90">{label}</span>
      {count != null ? (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">({count})</span>
      ) : null}
    </label>
  )
}

function MultiSelectSection({
  paramKey,
  options,
  selected,
  counts,
  state,
}: {
  paramKey: string
  options: readonly BoardbagFacetOption[]
  selected: string[]
  counts: Record<string, number> | undefined
  state: BoardbagsFilterState
}) {
  return (
    <div className="flex flex-col">
      {options.map((opt) => (
        <CheckRow
          key={opt.value}
          id={`boardbags-facet-${paramKey}-${opt.value}`}
          label={opt.label}
          checked={selected.includes(opt.value)}
          count={counts?.[opt.value]}
          onToggle={() => state.toggleMulti(paramKey, opt.value)}
        />
      ))}
    </div>
  )
}

function PriceSection({ state }: { state: BoardbagsFilterState }) {
  const [min, setMin] = useState(state.minPrice)
  const [max, setMax] = useState(state.maxPrice)

  useEffect(() => setMin(state.minPrice), [state.minPrice])
  useEffect(() => setMax(state.maxPrice), [state.maxPrice])

  const commit = (nextMin: string, nextMax: string) => {
    const normMin = nextMin.trim()
    const normMax = nextMax.trim()
    if (normMin === state.minPrice.trim() && normMax === state.maxPrice.trim()) return
    state.setPriceRange(nextMin || null, nextMax || null)
  }

  return (
    <div className="flex items-center gap-2 pt-1">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <Input
          inputMode="numeric"
          aria-label="Minimum price"
          value={min}
          placeholder="0"
          className="h-9 rounded-md pl-5 text-sm"
          onChange={(e) => setMin(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={() => commit(min, max)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commit(min, max)
            }
          }}
        />
      </div>
      <span className="text-muted-foreground">–</span>
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <Input
          inputMode="numeric"
          aria-label="Maximum price"
          value={max}
          placeholder={`${PRICE_MAX_HINT}`}
          className="h-9 rounded-md pl-5 text-sm"
          onChange={(e) => setMax(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={() => commit(min, max)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commit(min, max)
            }
          }}
        />
      </div>
    </div>
  )
}

function BrandSection({ state }: { state: BoardbagsFilterState }) {
  const [brandText, setBrandText] = useState(state.brand)
  const brandTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setBrandText(state.brand), [state.brand])

  return (
    <div className="space-y-1.5 pt-1">
      <Label className="text-xs font-medium text-foreground/80">Brand</Label>
      <Input
        value={brandText}
        placeholder="e.g. Rip Curl, O'Neill"
        className="h-9 text-sm"
        onChange={(e) => {
          const v = e.target.value
          setBrandText(v)
          if (brandTimer.current) clearTimeout(brandTimer.current)
          brandTimer.current = setTimeout(() => state.setBrand(v), 420)
        }}
        onBlur={() => {
          if (brandTimer.current) clearTimeout(brandTimer.current)
          state.setBrand(brandText)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            if (brandTimer.current) clearTimeout(brandTimer.current)
            state.setBrand(brandText)
          }
        }}
      />
    </div>
  )
}

export function BoardbagsBrowseFacetControls({
  state,
  counts = {},
}: {
  state: BoardbagsFilterState
  counts?: FacetCountsMap
}) {
  const { selections } = state
  const hasSizeOptions = BOARDBAG_SIZE_OPTIONS.length > 0
  const sectionIds = [
    ...(hasSizeOptions ? ["size"] : []),
    "brand",
    "condition",
    "price",
  ]

  return (
    <Accordion type="multiple" defaultValue={sectionIds} className="w-full">
      {hasSizeOptions ? (
        <FacetAccordionItem id="size" title="Size">
          <MultiSelectSection
            paramKey={BOARDBAG_FACET_PARAM_KEYS.size}
            options={BOARDBAG_SIZE_OPTIONS}
            selected={selections.sizes}
            counts={counts[BOARDBAG_FACET_PARAM_KEYS.size]}
            state={state}
          />
        </FacetAccordionItem>
      ) : null}

      <FacetAccordionItem id="brand" title="Brand">
        <BrandSection state={state} />
      </FacetAccordionItem>

      <FacetAccordionItem id="condition" title="Condition">
        <MultiSelectSection
          paramKey={BOARDBAG_FACET_PARAM_KEYS.condition}
          options={BOARDBAG_CONDITION_OPTIONS}
          selected={selections.conditions}
          counts={counts[BOARDBAG_FACET_PARAM_KEYS.condition]}
          state={state}
        />
      </FacetAccordionItem>

      <FacetAccordionItem id="price" title="Price">
        <PriceSection state={state} />
      </FacetAccordionItem>
    </Accordion>
  )
}

function FacetAccordionItem({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <AccordionItem value={id} className="border-b border-border/70">
      <AccordionTrigger className="py-3 text-sm font-semibold text-foreground hover:no-underline">
        {title}
      </AccordionTrigger>
      <AccordionContent className="pb-3">{children}</AccordionContent>
    </AccordionItem>
  )
}
