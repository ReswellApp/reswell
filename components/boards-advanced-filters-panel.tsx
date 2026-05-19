"use client"

import { Suspense, useMemo, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, SlidersHorizontal } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { BoardsBrowseCatalogBrandModel } from "@/components/boards-browse-catalog-brand-model"
import { BoardsSaveSearchPanel } from "@/components/boards-save-search-panel"
import {
  BoardDimensionsInputFields,
  type BoardDimensionsInputValues,
} from "@/components/board-dimensions-input-fields"
import { siteFilterBorderedInputClassName } from "@/components/site-search-bar"
import type { SellBrandModelCatalogRow } from "@/app/actions/marketplace"
import type { BoardsBrowseFilterFields } from "@/lib/utils/board-saved-search-criteria"
import {
  boardSavedSearchCriteriaFromFilters,
  countActiveAdvancedBrowseFilters,
  hasActiveAdvancedBrowseFilters,
} from "@/lib/utils/board-saved-search-criteria"
import { cn } from "@/lib/utils"

function AdvancedField({
  id,
  label,
  hint,
  children,
  className,
}: {
  id: string
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-foreground/90">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export type BoardsAdvancedFiltersPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  filterFields: BoardsBrowseFilterFields
  dimensionFields: BoardDimensionsInputValues
  minPrice: string
  maxPrice: string
  brand: string
  catalogBrandId: string
  model: string
  onDimensionFieldsChange: (patch: Partial<BoardDimensionsInputValues>) => void
  onMinPriceChange: (value: string) => void
  onMaxPriceChange: (value: string) => void
  onBrandTextChange: (value: string) => void
  onCatalogBrandPicked: (b: { id: string; name: string; slug: string }) => void
  onModelTextChange: (value: string) => void
  onCatalogModelPicked: (row: SellBrandModelCatalogRow) => void
  onApplyFilters: () => void
  onClearAdvanced: () => void
  isPending?: boolean
}

export function BoardsAdvancedFiltersPanel({
  open,
  onOpenChange,
  filterFields,
  dimensionFields,
  minPrice,
  maxPrice,
  brand,
  catalogBrandId,
  model,
  onDimensionFieldsChange,
  onMinPriceChange,
  onMaxPriceChange,
  onBrandTextChange,
  onCatalogBrandPicked,
  onModelTextChange,
  onCatalogModelPicked,
  onApplyFilters,
  onClearAdvanced,
  isPending = false,
}: BoardsAdvancedFiltersPanelProps) {
  const advancedActiveCount = countActiveAdvancedBrowseFilters(filterFields)
  const hasAdvanced = hasActiveAdvancedBrowseFilters(filterFields)
  const saveCriteria = useMemo(
    () => boardSavedSearchCriteriaFromFilters(filterFields),
    [filterFields],
  )

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="mt-4 w-full min-w-0">
      <div
        className={cn(
          "overflow-hidden rounded-2xl border bg-card shadow-sm transition-colors",
          open ? "border-border" : "border-border/80",
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors",
              "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cerulean/20 focus-visible:ring-offset-2",
            )}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <SlidersHorizontal className="h-4 w-4 text-foreground/80" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Advanced filters</span>
                {advancedActiveCount > 0 ? (
                  <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px] font-medium">
                    {advancedActiveCount} active
                  </Badge>
                ) : null}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Brand, model, dimensions, and price — results update as you type
              </span>
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-5 border-t border-border/80 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Refine listings below. Location and radius in the bar above only affect this page.
              Saved email alerts use brand, model, size, and price — not location.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2">
                <BoardsBrowseCatalogBrandModel
                  showLabels
                  brandText={brand}
                  catalogBrandId={catalogBrandId}
                  modelText={model}
                  onBrandTextChange={onBrandTextChange}
                  onCatalogBrandPicked={onCatalogBrandPicked}
                  onModelTextChange={onModelTextChange}
                  onCatalogModelPicked={onCatalogModelPicked}
                />
              </div>

              <BoardDimensionsInputFields
                idPrefix="boards-advanced"
                variant="filter"
                values={dimensionFields}
                onChange={onDimensionFieldsChange}
                onEnter={onApplyFilters}
              />

              <AdvancedField id="boards-advanced-min-price" label="Min price">
                <Input
                  id="boards-advanced-min-price"
                  name="minPrice"
                  inputMode="numeric"
                  value={minPrice}
                  onChange={(e) => onMinPriceChange(e.target.value)}
                  placeholder="USD"
                  className={siteFilterBorderedInputClassName()}
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      onApplyFilters()
                    }
                  }}
                />
              </AdvancedField>

              <AdvancedField id="boards-advanced-max-price" label="Max price" className="sm:col-span-1">
                <Input
                  id="boards-advanced-max-price"
                  name="maxPrice"
                  inputMode="numeric"
                  value={maxPrice}
                  onChange={(e) => onMaxPriceChange(e.target.value)}
                  placeholder="USD"
                  className={siteFilterBorderedInputClassName()}
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      onApplyFilters()
                    }
                  }}
                />
              </AdvancedField>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {isPending
                  ? "Updating results…"
                  : "Results update automatically · press Enter or Update for instant refresh"}
              </p>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  disabled={!hasAdvanced}
                  onClick={onClearAdvanced}
                >
                  Clear advanced
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full"
                  onClick={onApplyFilters}
                  disabled={isPending}
                >
                  Update results
                </Button>
              </div>
            </div>

            <Separator />

            <Suspense fallback={null}>
              <BoardsSaveSearchPanel criteria={saveCriteria} />
            </Suspense>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
