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
  MAGAZINE_CONDITION_OPTIONS,
  MAGAZINE_FACET_PARAM_KEYS,
  type MagazineFacetOption,
} from "@/lib/magazines-browse-facets"
import { cn } from "@/lib/utils"
import type { MagazinesFilterState } from "@/components/magazines-browse-filter-state"

const PRICE_MAX_HINT = 5000
const YEAR_MAX_HINT = new Date().getFullYear()

type CheckRowProps = {
  checked: boolean
  count: number | undefined
  label: string
  onToggle: () => void
  id: string
}

function CheckRow({ checked, count, label, onToggle, id }: CheckRowProps) {
  const disabled = count != null && !checked && count === 0
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
  state,
}: {
  paramKey: string
  options: readonly MagazineFacetOption[]
  selected: string[]
  state: MagazinesFilterState
}) {
  return (
    <div className="flex flex-col">
      {options.map((opt) => (
        <CheckRow
          key={opt.value}
          id={`magazines-facet-${paramKey}-${opt.value}`}
          label={opt.label}
          checked={selected.includes(opt.value)}
          count={undefined}
          onToggle={() => state.toggleMulti(paramKey, opt.value)}
        />
      ))}
    </div>
  )
}

function PriceSection({ state }: { state: MagazinesFilterState }) {
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

function YearSection({ state }: { state: MagazinesFilterState }) {
  const [min, setMin] = useState(state.minYear)
  const [max, setMax] = useState(state.maxYear)

  useEffect(() => setMin(state.minYear), [state.minYear])
  useEffect(() => setMax(state.maxYear), [state.maxYear])

  const commit = (nextMin: string, nextMax: string) => {
    const normMin = nextMin.trim()
    const normMax = nextMax.trim()
    if (normMin === state.minYear.trim() && normMax === state.maxYear.trim()) return
    state.setYearRange(nextMin || null, nextMax || null)
  }

  return (
    <div className="flex items-center gap-2 pt-1">
      <Input
        inputMode="numeric"
        aria-label="Earliest year"
        value={min}
        placeholder="1970"
        className="h-9 rounded-md text-sm"
        onChange={(e) => setMin(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={() => commit(min, max)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commit(min, max)
          }
        }}
      />
      <span className="text-muted-foreground">–</span>
      <Input
        inputMode="numeric"
        aria-label="Latest year"
        value={max}
        placeholder={`${YEAR_MAX_HINT}`}
        className="h-9 rounded-md text-sm"
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
  )
}

function BrandSection({ state }: { state: MagazinesFilterState }) {
  const [brandText, setBrandText] = useState(state.brand)
  const brandTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setBrandText(state.brand), [state.brand])

  return (
    <div className="space-y-1.5 pt-1">
      <Label className="text-xs font-medium text-foreground/80">Brand / publication</Label>
      <Input
        value={brandText}
        placeholder="e.g. Surfer, Surfing"
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

export function MagazinesBrowseFacetControls({ state }: { state: MagazinesFilterState }) {
  const { selections } = state
  const sectionIds = ["brand", "year", "condition", "price"]

  return (
    <Accordion type="multiple" defaultValue={sectionIds} className="w-full">
      <FacetAccordionItem id="brand" title="Brand">
        <BrandSection state={state} />
      </FacetAccordionItem>

      <FacetAccordionItem id="year" title="Year">
        <YearSection state={state} />
      </FacetAccordionItem>

      <FacetAccordionItem id="condition" title="Condition">
        <MultiSelectSection
          paramKey={MAGAZINE_FACET_PARAM_KEYS.condition}
          options={MAGAZINE_CONDITION_OPTIONS}
          selected={selections.conditions}
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
