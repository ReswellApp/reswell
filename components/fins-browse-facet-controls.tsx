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
  FIN_CONDITION_OPTIONS,
  FIN_FACET_PARAM_KEYS,
  type FinFacetOption,
} from "@/lib/fins-browse-facets"
import {
  FIN_SETUP_OPTIONS,
  FIN_SYSTEM_OPTIONS_FOR_FINS,
  FIN_SIZE_OPTIONS,
} from "@/lib/fin-listing-config"
import { cn } from "@/lib/utils"
import type { FinsFilterState } from "@/components/fins-browse-filter-state"

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
  options: readonly FinFacetOption[]
  selected: string[]
  counts: Record<string, number> | undefined
  state: FinsFilterState
}) {
  return (
    <div className="flex flex-col">
      {options.map((opt) => (
        <CheckRow
          key={opt.value}
          id={`fins-facet-${paramKey}-${opt.value}`}
          label={opt.label}
          checked={selected.includes(opt.value)}
          count={counts?.[opt.value]}
          onToggle={() => state.toggleMulti(paramKey, opt.value)}
        />
      ))}
    </div>
  )
}

function PriceSection({ state }: { state: FinsFilterState }) {
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

function BrandSection({ state }: { state: FinsFilterState }) {
  const [brandText, setBrandText] = useState(state.brand)
  const brandTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setBrandText(state.brand), [state.brand])

  return (
    <div className="space-y-1.5 pt-1">
      <Label className="text-xs font-medium text-foreground/80">Brand</Label>
      <Input
        value={brandText}
        placeholder="e.g. FCS, Futures"
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

const SECTION_IDS = ["finSetup", "finSystem", "size", "brand", "condition", "price"] as const

export function FinsBrowseFacetControls({
  state,
  counts = {},
}: {
  state: FinsFilterState
  counts?: FacetCountsMap
}) {
  const { selections } = state

  return (
    <Accordion type="multiple" defaultValue={[...SECTION_IDS]} className="w-full">
      <FacetAccordionItem id="finSetup" title="Fin Setup">
        <MultiSelectSection
          paramKey={FIN_FACET_PARAM_KEYS.finSetup}
          options={FIN_SETUP_OPTIONS}
          selected={selections.finSetups}
          counts={counts[FIN_FACET_PARAM_KEYS.finSetup]}
          state={state}
        />
      </FacetAccordionItem>

      <FacetAccordionItem id="finSystem" title="Fin System">
        <MultiSelectSection
          paramKey={FIN_FACET_PARAM_KEYS.finSystem}
          options={FIN_SYSTEM_OPTIONS_FOR_FINS}
          selected={selections.finSystems}
          counts={counts[FIN_FACET_PARAM_KEYS.finSystem]}
          state={state}
        />
      </FacetAccordionItem>

      <FacetAccordionItem id="size" title="Size">
        <MultiSelectSection
          paramKey={FIN_FACET_PARAM_KEYS.size}
          options={FIN_SIZE_OPTIONS}
          selected={selections.sizes}
          counts={counts[FIN_FACET_PARAM_KEYS.size]}
          state={state}
        />
      </FacetAccordionItem>

      <FacetAccordionItem id="brand" title="Brand">
        <BrandSection state={state} />
      </FacetAccordionItem>

      <FacetAccordionItem id="condition" title="Condition">
        <MultiSelectSection
          paramKey={FIN_FACET_PARAM_KEYS.condition}
          options={FIN_CONDITION_OPTIONS}
          selected={selections.conditions}
          counts={counts[FIN_FACET_PARAM_KEYS.condition]}
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
