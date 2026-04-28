"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
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
}

const UNSELECTED_VALUE = "__sell_board_model_none__"

type SellBoardModelFieldProps = {
  /** Directory brand id when the seller matched a row in `public.brands` — used to fetch optional catalog models only. Model entry is never blocked without this. */
  catalogBrandId: string
  linkedBrandDisplayName: string
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
  catalogBrandId,
  linkedBrandDisplayName,
  modelName,
  modelCatalogSlug,
  boardIndexBrandSlug,
  onCatalogModelChange,
  onRequestCatalogAdd,
  disabled,
}: SellBoardModelFieldProps) {
  const [models, setModels] = React.useState<SellBrandModelCatalogRow[]>([])
  const [resolvedBrandSlug, setResolvedBrandSlug] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!catalogBrandId.trim()) {
      setModels([])
      setResolvedBrandSlug("")
      setLoadError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    void getBrandModelsCatalogForSellForm(catalogBrandId.trim()).then((res) => {
      if (cancelled) return
      setLoading(false)
      if (!res.ok) {
        setModels([])
        setResolvedBrandSlug("")
        setLoadError(res.error)
        return
      }
      setModels(res.models)
      setResolvedBrandSlug(res.brandSlug)
      setLoadError(null)
    })
    return () => {
      cancelled = true
    }
  }, [catalogBrandId])

  const brandForLabel = linkedBrandDisplayName.trim()

  /** Slug for index/snapshot: directory pick > API-resolved brand > slugified display name (free-typed brand). */
  const effectiveBrandSlug =
    boardIndexBrandSlug.trim() || resolvedBrandSlug || (brandForLabel ? slugify(brandForLabel) : "")

  const selectedModelId = React.useMemo(() => {
    const name = modelName.trim()
    const slug = modelCatalogSlug.trim()
    if (!name && !slug) return UNSELECTED_VALUE
    const bySlug = models.find((m) => m.catalogSlug === slug)
    if (bySlug) return bySlug.id
    const bySlugifiedName = slug && models.find((m) => slugify(m.name) === slug)
    if (bySlugifiedName) return bySlugifiedName.id
    const byName = models.find((m) => m.name.trim().toLowerCase() === name.toLowerCase())
    if (byName) return byName.id
    return UNSELECTED_VALUE
  }, [modelCatalogSlug, modelName, models])

  const showLegacyMismatch =
    Boolean(modelName.trim()) &&
    selectedModelId === UNSELECTED_VALUE &&
    models.length > 0 &&
    !loading

  const brandForRequest = linkedBrandDisplayName.trim()

  function applyFreeformModelValue(raw: string) {
    const v = raw
    const slugOut = effectiveBrandSlug.trim()
    const brandLabel = brandForRequest
    onCatalogModelChange({
      boardModelName: v,
      boardIndexModelSlug: v.trim() ? slugify(v) : "",
      boardIndexBrandSlug: slugOut,
      boardIndexLabel:
        v.trim() && brandLabel ? `${brandLabel} ${v.trim()}`.trim() : brandLabel,
    })
  }

  function applyCatalogRow(row: SellBrandModelCatalogRow) {
    const slugOut = effectiveBrandSlug.trim()
    const brandLabel = linkedBrandDisplayName.trim()
    onCatalogModelChange({
      boardModelName: row.name,
      boardIndexModelSlug: row.catalogSlug,
      boardIndexBrandSlug: slugOut,
      boardIndexLabel: `${brandLabel} ${row.name}`.trim(),
    })
  }

  const modelPlaceholder =
    catalogBrandId.trim() && loading
      ? "Loading catalog models…"
      : catalogBrandId.trim() && models.length > 0
        ? "Type your model — matches appear as you type"
        : "e.g., Step Deck Noserider — type the model as you know it"

  const modelsForCombobox =
    catalogBrandId.trim() && !loadError && !loading ? models : []

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <Label htmlFor="listing-board-model-select">Model *</Label>
        <span
          className={cn(
            "text-xs tabular-nums",
            modelName.length > LISTING_BOARD_MODEL_MAX_LENGTH
              ? "font-medium text-destructive"
              : "text-muted-foreground/45",
          )}
          aria-live="polite"
        >
          {modelName.length}/{LISTING_BOARD_MODEL_MAX_LENGTH}
        </span>
      </div>

      {catalogBrandId.trim() && loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : null}

      <SurfboardModelCatalogInput
        id="listing-board-model-select"
        placeholder={modelPlaceholder}
        disabled={disabled}
        value={modelName}
        onFreeTextChange={applyFreeformModelValue}
        onPickCatalogRow={applyCatalogRow}
        models={modelsForCombobox}
      />

      {catalogBrandId.trim() && loading ? (
        <p className="text-xs text-muted-foreground">Loading models for this brand…</p>
      ) : null}

      {catalogBrandId.trim() && !loading && models.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No models in our catalog for this brand yet — your text above is what we&apos;ll use. You can ask us to add this model once it&apos;s in the directory.
        </p>
      ) : null}

      {catalogBrandId.trim() &&
      !loading &&
      models.length > 0 &&
      showLegacyMismatch ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Your saved model isn&apos;t in our catalog yet — keep your text above, pick a match from suggestions, or request we add it.
        </p>
      ) : null}

      <button
        type="button"
        className="text-left text-xs font-normal text-primary hover:text-primary/90 disabled:pointer-events-none disabled:opacity-50"
        disabled={Boolean(disabled)}
        onClick={() => onRequestCatalogAdd()}
      >
        Model not listed? Request we add it
      </button>
    </div>
  )
}
