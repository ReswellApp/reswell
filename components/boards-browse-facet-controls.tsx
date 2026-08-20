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
import { BoardsBrowseCatalogBrandModel } from "@/components/boards-browse-catalog-brand-model"
import { BoardsBrowseLocationFilter } from "@/components/boards-browse-location-filter"
import {
  BOARD_STYLE_OPTIONS,
  CONDITION_OPTIONS,
  CONSTRUCTION_OPTIONS,
  FACET_PARAM_KEYS,
  FIN_SETUP_OPTIONS,
  FIN_SYSTEM_OPTIONS,
  LENGTH_BUCKETS,
  VOLUME_BUCKETS,
  type FacetOption,
  type RangeBucket,
} from "@/lib/boards-browse-facets"
import { cn } from "@/lib/utils"
import type { BoardsFilterState } from "@/components/boards-browse-filter-state"

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
  options: readonly FacetOption[]
  selected: string[]
  counts: Record<string, number> | undefined
  state: BoardsFilterState
}) {
  return (
    <div className="flex flex-col">
      {options.map((opt) => (
        <CheckRow
          key={opt.value}
          id={`facet-${paramKey}-${opt.value}`}
          label={opt.label}
          checked={selected.includes(opt.value)}
          count={counts?.[opt.value]}
          onToggle={() => state.toggleMulti(paramKey, opt.value)}
        />
      ))}
    </div>
  )
}

function RangeSection({
  paramKey,
  buckets,
  selected,
  counts,
  state,
}: {
  paramKey: string
  buckets: readonly RangeBucket[]
  selected: string[]
  counts: Record<string, number> | undefined
  state: BoardsFilterState
}) {
  return (
    <div className="flex flex-col">
      {buckets.map((b) => (
        <CheckRow
          key={b.value}
          id={`facet-${paramKey}-${b.value}`}
          label={b.label}
          checked={selected.includes(b.value)}
          count={counts?.[b.value]}
          onToggle={() => state.toggleMulti(paramKey, b.value)}
        />
      ))}
    </div>
  )
}

function PriceSection({ state }: { state: BoardsFilterState }) {
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

function BrandModelSection({ state }: { state: BoardsFilterState }) {
  const [brandText, setBrandText] = useState(state.brand)
  const [modelText, setModelText] = useState(state.model)
  const brandTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setBrandText(state.brand), [state.brand])
  useEffect(() => setModelText(state.model), [state.model])

  return (
    <div className="space-y-3 pt-1">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-foreground/80">Brand</Label>
        <BoardsBrowseCatalogBrandModel
          field="brand"
          brandText={brandText}
          catalogBrandId={state.brandId}
          modelText={modelText}
          onBrandTextChange={(v) => {
            setBrandText(v)
            if (brandTimer.current) clearTimeout(brandTimer.current)
            brandTimer.current = setTimeout(() => {
              state.setBrand({ brand: v, brandId: "", model: state.model, brandModelId: "" })
            }, 420)
          }}
          onCatalogBrandPicked={(b) => {
            if (brandTimer.current) clearTimeout(brandTimer.current)
            setBrandText(b.name)
            state.setBrand({ brand: b.name, brandId: b.id })
          }}
          onModelTextChange={setModelText}
          onCatalogModelPicked={(row) => {
            setBrandText(row.brandName)
            setModelText(row.name)
            state.setBrand({
              brand: row.brandName,
              brandId: row.brandId,
              model: row.name,
              brandModelId: row.id,
            })
          }}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-foreground/80">Model</Label>
        <BoardsBrowseCatalogBrandModel
          field="model"
          portaledModelDropdown
          brandText={brandText}
          catalogBrandId={state.brandId}
          modelText={modelText}
          onBrandTextChange={setBrandText}
          onCatalogBrandPicked={(b) => state.setBrand({ brand: b.name, brandId: b.id })}
          onModelTextChange={(v) => {
            setModelText(v)
            if (modelTimer.current) clearTimeout(modelTimer.current)
            modelTimer.current = setTimeout(() => {
              state.setModel({ model: v, brandModelId: "" })
            }, 420)
          }}
          onCatalogModelPicked={(row) => {
            setBrandText(row.brandName)
            setModelText(row.name)
            state.setBrand({
              brand: row.brandName,
              brandId: row.brandId,
              model: row.name,
              brandModelId: row.id,
            })
          }}
        />
      </div>
    </div>
  )
}

const SECTION_IDS = [
  "price",
  "location",
  "shipping",
  "style",
  "length",
  "volume",
  "fin",
  "finSystem",
  "construction",
  "brand",
  "condition",
] as const

export function BoardsBrowseFacetControls({
  state,
  counts,
  locationListboxId,
}: {
  state: BoardsFilterState
  counts: FacetCountsMap
  locationListboxId: string
}) {
  const { selections } = state

  return (
    <Accordion
      type="multiple"
      defaultValue={[...SECTION_IDS]}
      className="w-full"
    >
      <FacetAccordionItem id="price" title="Price">
        <PriceSection state={state} />
      </FacetAccordionItem>

      <FacetAccordionItem id="location" title="Location">
        <BoardsBrowseLocationFilter state={state} listboxId={locationListboxId} />
      </FacetAccordionItem>

      <FacetAccordionItem id="shipping" title="Shipping">
        <label
          htmlFor="facet-shipping-available"
          className="flex cursor-pointer items-center gap-2.5 py-1.5 text-sm"
        >
          <Checkbox
            id="facet-shipping-available"
            checked={state.shippingAvailable}
            onCheckedChange={(checked) => state.setShippingAvailable(checked === true)}
            className="shrink-0"
          />
          <span className="min-w-0 flex-1 text-foreground/90">Shipping available</span>
        </label>
      </FacetAccordionItem>

      <FacetAccordionItem id="style" title="Board Style">
        <MultiSelectSection
          paramKey={FACET_PARAM_KEYS.style}
          options={BOARD_STYLE_OPTIONS}
          selected={selections.styles}
          counts={counts[FACET_PARAM_KEYS.style]}
          state={state}
        />
      </FacetAccordionItem>

      <FacetAccordionItem id="length" title="Length">
        <RangeSection
          paramKey={FACET_PARAM_KEYS.length}
          buckets={LENGTH_BUCKETS}
          selected={selections.lengthBuckets}
          counts={counts[FACET_PARAM_KEYS.length]}
          state={state}
        />
      </FacetAccordionItem>

      <FacetAccordionItem id="volume" title="Volume">
        <RangeSection
          paramKey={FACET_PARAM_KEYS.volume}
          buckets={VOLUME_BUCKETS}
          selected={selections.volumeBuckets}
          counts={counts[FACET_PARAM_KEYS.volume]}
          state={state}
        />
      </FacetAccordionItem>

      <FacetAccordionItem id="fin" title="Fin Setup">
        <MultiSelectSection
          paramKey={FACET_PARAM_KEYS.finSetup}
          options={FIN_SETUP_OPTIONS}
          selected={selections.finSetups}
          counts={counts[FACET_PARAM_KEYS.finSetup]}
          state={state}
        />
      </FacetAccordionItem>

      <FacetAccordionItem id="finSystem" title="Fin System">
        <MultiSelectSection
          paramKey={FACET_PARAM_KEYS.finSystem}
          options={FIN_SYSTEM_OPTIONS}
          selected={selections.finSystems}
          counts={counts[FACET_PARAM_KEYS.finSystem]}
          state={state}
        />
      </FacetAccordionItem>

      <FacetAccordionItem id="construction" title="Board Construction">
        <MultiSelectSection
          paramKey={FACET_PARAM_KEYS.construction}
          options={CONSTRUCTION_OPTIONS}
          selected={selections.constructions}
          counts={counts[FACET_PARAM_KEYS.construction]}
          state={state}
        />
      </FacetAccordionItem>

      <FacetAccordionItem id="brand" title="Brand & Model">
        <BrandModelSection state={state} />
      </FacetAccordionItem>

      <FacetAccordionItem id="condition" title="Condition">
        <MultiSelectSection
          paramKey={FACET_PARAM_KEYS.condition}
          options={CONDITION_OPTIONS}
          selected={selections.conditions}
          counts={counts[FACET_PARAM_KEYS.condition]}
          state={state}
        />
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
