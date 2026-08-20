"use client"

import { useEffect, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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

const PRIMARY_SECTION_IDS = [
  "price",
  "location",
  "shipping",
  "style",
  "condition",
] as const

const ADVANCED_SECTION_IDS = [
  "length",
  "volume",
  "fin",
  "finSystem",
  "construction",
] as const

function advancedFilterCount(selections: BoardsFilterState["selections"]): number {
  return (
    selections.lengthBuckets.length +
    selections.volumeBuckets.length +
    selections.finSetups.length +
    selections.finSystems.length +
    selections.constructions.length
  )
}

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
  const advancedCount = advancedFilterCount(selections)

  return (
    <Accordion
      type="multiple"
      defaultValue={[
        ...PRIMARY_SECTION_IDS,
        ...(advancedCount > 0 ? (["advanced"] as const) : []),
      ]}
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

      <FacetAccordionItem id="condition" title="Condition">
        <MultiSelectSection
          paramKey={FACET_PARAM_KEYS.condition}
          options={CONDITION_OPTIONS}
          selected={selections.conditions}
          counts={counts[FACET_PARAM_KEYS.condition]}
          state={state}
        />
      </FacetAccordionItem>

      <FacetAccordionItem
        id="advanced"
        title={
          <span className="flex items-center gap-2">
            Advanced
            {advancedCount > 0 ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                ({advancedCount})
              </span>
            ) : null}
          </span>
        }
      >
        <Accordion
          type="multiple"
          defaultValue={[...ADVANCED_SECTION_IDS]}
          className="w-full"
        >
          <FacetAccordionItem id="length" title="Length" nested>
            <RangeSection
              paramKey={FACET_PARAM_KEYS.length}
              buckets={LENGTH_BUCKETS}
              selected={selections.lengthBuckets}
              counts={counts[FACET_PARAM_KEYS.length]}
              state={state}
            />
          </FacetAccordionItem>

          <FacetAccordionItem id="volume" title="Volume" nested>
            <RangeSection
              paramKey={FACET_PARAM_KEYS.volume}
              buckets={VOLUME_BUCKETS}
              selected={selections.volumeBuckets}
              counts={counts[FACET_PARAM_KEYS.volume]}
              state={state}
            />
          </FacetAccordionItem>

          <FacetAccordionItem id="fin" title="Fin Setup" nested>
            <MultiSelectSection
              paramKey={FACET_PARAM_KEYS.finSetup}
              options={FIN_SETUP_OPTIONS}
              selected={selections.finSetups}
              counts={counts[FACET_PARAM_KEYS.finSetup]}
              state={state}
            />
          </FacetAccordionItem>

          <FacetAccordionItem id="finSystem" title="Fin System" nested>
            <MultiSelectSection
              paramKey={FACET_PARAM_KEYS.finSystem}
              options={FIN_SYSTEM_OPTIONS}
              selected={selections.finSystems}
              counts={counts[FACET_PARAM_KEYS.finSystem]}
              state={state}
            />
          </FacetAccordionItem>

          <FacetAccordionItem id="construction" title="Board Construction" nested>
            <MultiSelectSection
              paramKey={FACET_PARAM_KEYS.construction}
              options={CONSTRUCTION_OPTIONS}
              selected={selections.constructions}
              counts={counts[FACET_PARAM_KEYS.construction]}
              state={state}
            />
          </FacetAccordionItem>
        </Accordion>
      </FacetAccordionItem>
    </Accordion>
  )
}

function FacetAccordionItem({
  id,
  title,
  children,
  nested = false,
}: {
  id: string
  title: React.ReactNode
  children: React.ReactNode
  nested?: boolean
}) {
  return (
    <AccordionItem
      value={id}
      className={cn("border-border/70", nested ? "border-b last:border-b-0" : "border-b")}
    >
      <AccordionTrigger
        className={cn(
          "py-3 text-sm font-semibold text-foreground hover:no-underline",
          nested && "py-2 text-[13px] font-medium text-foreground/80",
        )}
      >
        {title}
      </AccordionTrigger>
      <AccordionContent className={cn("pb-3", nested && "pb-2")}>{children}</AccordionContent>
    </AccordionItem>
  )
}
