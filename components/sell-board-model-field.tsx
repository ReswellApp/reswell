"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { SellRequiredMark } from "@/components/features/sell/sell-required-mark"
import { cn } from "@/lib/utils"
import {
  getBrandModelsCatalogForSellForm,
  type SellBrandModelCatalogRow,
} from "@/app/actions/marketplace"
import { LISTING_BOARD_MODEL_MAX_LENGTH } from "@/lib/sell-form-validation"
import { slugify } from "@/lib/slugify"
import { SurfboardModelCatalogInput } from "@/components/surfboard-model-catalog-input"

export type SellBoardModelCatalogPatch = {
  boardModelName: string
  boardIndexModelSlug: string
  boardIndexBrandSlug: string
  boardIndexLabel: string
  /** `public.brand_models.id` when the seller picked a catalog row; omit or clear for free-text model. */
  boardBrandModelId?: string
  boardBrandId?: string
  brand?: string
  boardLinkedBrandName?: string
}

type SellBoardModelFieldProps = {
  linkedBrandDisplayName: string
  /**
   * When the seller picked a row from the brand directory (`public.brands`), only catalog models
   * for that brand are shown in the model picker. Free-typed brand (no id) keeps the full list.
   */
  directoryBrandId?: string
  modelName: string
  modelCatalogSlug: string
  /** Existing slug from the sell form; overwritten when a catalog row is picked. */
  boardIndexBrandSlug: string
  onCatalogModelChange: (patch: SellBoardModelCatalogPatch) => void
  /** Opens the unified brand+model catalog request dialog (wired from `/sell`). */
  onRequestCatalogAdd: () => void
  disabled?: boolean
}

export function SellBoardModelField({
  linkedBrandDisplayName,
  directoryBrandId,
  modelName,
  modelCatalogSlug,
  boardIndexBrandSlug,
  onCatalogModelChange,
  onRequestCatalogAdd,
  disabled,
}: SellBoardModelFieldProps) {
  const [models, setModels] = React.useState<SellBrandModelCatalogRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    void getBrandModelsCatalogForSellForm().then((res) => {
      if (cancelled) return
      setLoading(false)
      if (!res.ok) {
        setModels([])
        setLoadError(res.error)
        return
      }
      setModels(res.models)
      setLoadError(null)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const brandForLabel = linkedBrandDisplayName.trim()
  const directoryId = directoryBrandId?.trim() ?? ""

  const modelsForPicker = React.useMemo(() => {
    if (!directoryId) return models
    return models.filter((m) => m.brandId === directoryId)
  }, [models, directoryId])

  /** Slug for index/snapshot: directory pick > slugified display name (free-typed brand). */
  const effectiveBrandSlug =
    boardIndexBrandSlug.trim() || (brandForLabel ? slugify(brandForLabel) : "")

  function applyFreeformModelValue(raw: string) {
    const v = raw
    const slugOut = effectiveBrandSlug.trim()
    const brandLabel = brandForLabel
    onCatalogModelChange({
      boardModelName: v,
      boardIndexModelSlug: v.trim() ? slugify(v) : "",
      boardIndexBrandSlug: slugOut,
      boardIndexLabel:
        v.trim() && brandLabel ? `${brandLabel} ${v.trim()}`.trim() : brandLabel,
      boardBrandModelId: "",
    })
  }

  function applyCatalogRow(row: SellBrandModelCatalogRow) {
    onCatalogModelChange({
      boardModelName: row.name,
      boardIndexModelSlug: row.catalogSlug,
      boardIndexBrandSlug: row.brandSlug,
      boardIndexLabel: `${row.brandName} ${row.name}`.trim(),
      boardBrandId: row.brandId,
      boardBrandModelId: row.id,
      brand: row.brandName,
      boardLinkedBrandName: row.brandName,
    })
  }

  const catalogReady = !loading && !loadError

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-end justify-between gap-2">
        <Label htmlFor="listing-board-model-select">
          Model{" "}
          <SellRequiredMark
            complete={
              Boolean(modelName.trim()) &&
              modelName.length <= LISTING_BOARD_MODEL_MAX_LENGTH
            }
          />
        </Label>
        <span
          className={cn(
            "text-xs tabular-nums",
            modelName.length > LISTING_BOARD_MODEL_MAX_LENGTH
              ? "font-medium text-destructive"
              : "text-muted-foreground",
          )}
          aria-live="polite"
        >
          {modelName.length}/{LISTING_BOARD_MODEL_MAX_LENGTH}
        </span>
      </div>

      {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}

      <SurfboardModelCatalogInput
        id="listing-board-model-select"
        placeholder=""
        disabled={disabled}
        catalogReady={catalogReady}
        value={modelName}
        onFreeTextChange={applyFreeformModelValue}
        onPickCatalogRow={applyCatalogRow}
        models={catalogReady ? modelsForPicker : []}
        onRequestCatalogAdd={onRequestCatalogAdd}
        catalogSuggestionsEnabled={Boolean(directoryId)}
      />
    </div>
  )
}
