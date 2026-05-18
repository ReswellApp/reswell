"use client"

import { useEffect, useMemo, useState } from "react"
import {
  getBrandModelsCatalogForSellForm,
  type SellBrandModelCatalogRow,
} from "@/app/actions/marketplace"
import { SearchInputWithSuggest } from "@/components/search-input-with-suggest"
import { SurfboardModelCatalogInput } from "@/components/surfboard-model-catalog-input"
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

  return (
    <>
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
          placeholder="Brand — search directory"
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
    </>
  )
}
