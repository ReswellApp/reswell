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
  /** Portal model dropdown to body (required inside horizontal overflow filter bars). */
  portaledModelDropdown?: boolean
}

/**
 * Advanced /boards filters: typeahead against `public.brands` and `public.brand_models` (same sources as /sell).
 */

let cachedModels: SellBrandModelCatalogRow[] | null = null
let cachedLoadError: string | null = null
let loadPromise: Promise<void> | null = null
const catalogSubscribers = new Set<() => void>()

function notifyCatalogSubscribers() {
  catalogSubscribers.forEach((listener) => listener())
}

function ensureBoardsBrowseBrandModelsCatalog(): Promise<void> {
  if (cachedModels !== null || cachedLoadError !== null) {
    return Promise.resolve()
  }
  if (loadPromise) return loadPromise

  loadPromise = getBrandModelsCatalogForSellForm()
    .then((res) => {
      if (res.ok) {
        cachedModels = res.models
        cachedLoadError = null
      } else {
        cachedModels = []
        cachedLoadError = res.error
      }
    })
    .catch(() => {
      cachedModels = []
      cachedLoadError = "Could not load model catalog."
    })
    .finally(() => {
      loadPromise = null
      notifyCatalogSubscribers()
    })

  return loadPromise
}

/** Warm the shared catalog cache as soon as /boards filters mount. */
export function prefetchBoardsBrowseBrandModelsCatalog(): void {
  void ensureBoardsBrowseBrandModelsCatalog()
}

function useBoardsBrowseBrandModelsCatalog() {
  const [catalogState, setCatalogState] = useState(() => ({
    models: cachedModels ?? [],
    ready: cachedModels !== null || cachedLoadError !== null,
  }))

  useEffect(() => {
    const sync = () => {
      setCatalogState({
        models: cachedModels ?? [],
        ready: cachedModels !== null || cachedLoadError !== null,
      })
    }
    catalogSubscribers.add(sync)
    void ensureBoardsBrowseBrandModelsCatalog().then(sync)
    return () => {
      catalogSubscribers.delete(sync)
    }
  }, [])

  return catalogState
}

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
  portaledModelDropdown = false,
}: BoardsBrowseCatalogBrandModelProps) {
  const { models, ready: catalogReady } = useBoardsBrowseBrandModelsCatalog()

  const modelsForPicker = useMemo(() => {
    const id = catalogBrandId.trim()
    if (id) return models.filter((m) => m.brandId === id)

    const brandQuery = brandText.trim().toLowerCase()
    if (brandQuery.length >= 1) {
      const narrowed = models.filter((m) => {
        const brandName = m.brandName.toLowerCase()
        const brandSlug = m.brandSlug.toLowerCase()
        return (
          brandName.includes(brandQuery) ||
          brandSlug.includes(brandQuery) ||
          brandName.split(/[\s\-'/.]+/).some((token) => token.startsWith(brandQuery))
        )
      })
      if (narrowed.length > 0) return narrowed
    }

    return models
  }, [models, catalogBrandId, brandText])

  const brandDirectoryId = catalogBrandId.trim()

  const modelPlaceholder = (() => {
    if (brandDirectoryId) {
      return modelsForPicker.length > 0
        ? "Search catalog models…"
        : "No catalog models for this brand — type to filter"
    }
    return models.length > 0
      ? "Search catalog models (pick a brand to narrow)"
      : "Search or type a model name"
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
        catalogReady={catalogReady}
        value={modelText}
        onFreeTextChange={onModelTextChange}
        onPickCatalogRow={onCatalogModelPicked}
        models={catalogReady ? modelsForPicker : []}
        catalogSuggestionsEnabled={catalogReady}
        portaledDropdown={portaledModelDropdown}
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
