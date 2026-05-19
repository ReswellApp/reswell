"use client"

import { useEffect, useMemo, useState } from "react"
import {
  getBrandModelsCatalogForSellForm,
  type SellBrandModelCatalogRow,
} from "@/app/actions/marketplace"
import { SearchInputWithSuggest } from "@/components/search-input-with-suggest"
import { SurfboardModelCatalogInput } from "@/components/surfboard-model-catalog-input"
import { Label } from "@/components/ui/label"
import { siteFilterBorderedInputClassName } from "@/components/site-search-bar"
import { cn } from "@/lib/utils"

export type BoardsBrowseCatalogBrandModelProps = {
  brandText: string
  catalogBrandId: string
  modelText: string
  onBrandTextChange: (next: string) => void
  onCatalogBrandPicked: (b: { id: string; name: string; slug: string }) => void
  onModelTextChange: (next: string) => void
  onCatalogModelPicked: (row: SellBrandModelCatalogRow) => void
  /** When set, render only the brand or model field. */
  field?: "brand" | "model" | "both"
  /** Show field labels (advanced filters panel). */
  showLabels?: boolean
}

/**
 * Advanced /boards filters: typeahead against `public.brands` and `public.brand_models` (same sources as /sell).
 */
export function BoardsBrowseCatalogBrandModel({
  brandText,
  catalogBrandId,
  modelText,
  onBrandTextChange,
  onCatalogBrandPicked,
  onModelTextChange,
  onCatalogModelPicked,
  field = "both",
  showLabels = false,
}: BoardsBrowseCatalogBrandModelProps) {
  const [models, setModels] = useState<SellBrandModelCatalogRow[]>([])
  const [catalogReady, setCatalogReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getBrandModelsCatalogForSellForm().then((res) => {
      if (cancelled) return
      if (!res.ok) {
        setModels([])
        setCatalogReady(true)
        return
      }
      setModels(res.models)
      setCatalogReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const modelsForPicker = useMemo(() => {
    const id = catalogBrandId.trim()
    if (!id) return models
    return models.filter((m) => m.brandId === id)
  }, [models, catalogBrandId])

  const brandDirectoryId = catalogBrandId.trim()

  const modelPlaceholder = (() => {
    if (!catalogReady) return "Loading models…"
    if (brandDirectoryId) {
      return modelsForPicker.length > 0 ? "Search catalog models…" : "No catalog models for this brand — type to filter"
    }
    return models.length > 0 ? "Search catalog models (pick a brand to narrow)" : "Search or type a model name"
  })()

  const brandInput = (
    <div className="min-w-0">
      <SearchInputWithSuggest
        id="boards-advanced-brand-catalog"
        suggestSource="brands"
        variant="boards"
        minLength={1}
        debounceMs={200}
        listboxId="boards-advanced-brand-suggest"
        value={brandText}
        onChange={onBrandTextChange}
        onCatalogBrandPicked={onCatalogBrandPicked}
        placeholder="Search brand directory"
        inputType="text"
        showClearButton
        autoOpenDropdownOnFetch
        showTypeLabels={false}
        analyticsSurface="other"
        disableSuggest={false}
        className="w-full min-w-0"
        inputClassName={cn(
          siteFilterBorderedInputClassName(),
          "rounded-full pl-3 pr-10 text-[15px]",
        )}
      />
    </div>
  )

  const modelInput = (
    <div className="min-w-0">
      <SurfboardModelCatalogInput
        id="boards-advanced-model-catalog"
        placeholder={modelPlaceholder}
        disabled={!catalogReady}
        catalogReady={catalogReady}
        value={modelText}
        onFreeTextChange={onModelTextChange}
        onPickCatalogRow={onCatalogModelPicked}
        models={catalogReady ? modelsForPicker : []}
        catalogSuggestionsEnabled
        className={cn(siteFilterBorderedInputClassName(), "rounded-full")}
      />
    </div>
  )

  if (field === "brand") {
    if (!showLabels) return brandInput
    return (
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="boards-advanced-brand-catalog" className="text-xs font-medium text-foreground/90">
          Brand
        </Label>
        {brandInput}
      </div>
    )
  }

  if (field === "model") {
    if (!showLabels) return modelInput
    return (
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="boards-advanced-model-catalog" className="text-xs font-medium text-foreground/90">
          Model
        </Label>
        {modelInput}
        {brandDirectoryId ? (
          <p className="text-[11px] leading-snug text-muted-foreground">Showing models for selected brand</p>
        ) : null}
      </div>
    )
  }

  if (!showLabels) {
    return (
      <>
        {brandInput}
        {modelInput}
      </>
    )
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="boards-advanced-brand-catalog" className="text-xs font-medium text-foreground/90">
          Brand
        </Label>
        {brandInput}
      </div>
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="boards-advanced-model-catalog" className="text-xs font-medium text-foreground/90">
          Model
        </Label>
        {modelInput}
        {brandDirectoryId ? (
          <p className="text-[11px] leading-snug text-muted-foreground">Showing models for selected brand</p>
        ) : null}
      </div>
    </div>
  )
}
