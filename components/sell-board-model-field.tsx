"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  getBrandModelsCatalogForSellForm,
  type SellBrandModelCatalogRow,
} from "@/app/actions/marketplace"
import { LISTING_BOARD_MODEL_MAX_LENGTH } from "@/lib/sell-form-validation"
import { slugify } from "@/lib/slugify"
import { RequestModelDialog } from "@/components/request-model-dialog"
import { Input } from "@/components/ui/input"

export type SellBoardModelCatalogPatch = {
  boardModelName: string
  boardIndexModelSlug: string
  boardIndexBrandSlug: string
  boardIndexLabel: string
}

const UNSELECTED_VALUE = "__sell_board_model_none__"

type SellBoardModelFieldProps = {
  /** Linked directory brand (`boardBrandId`) — models load only when set. */
  catalogBrandId: string
  linkedBrandDisplayName: string
  modelName: string
  modelCatalogSlug: string
  /** Existing slug from the sell form; overwritten when a catalog row is picked. */
  boardIndexBrandSlug: string
  onCatalogModelChange: (patch: SellBoardModelCatalogPatch) => void
  disabled?: boolean
}

export function SellBoardModelField({
  catalogBrandId,
  linkedBrandDisplayName,
  modelName,
  modelCatalogSlug,
  boardIndexBrandSlug,
  onCatalogModelChange,
  disabled,
}: SellBoardModelFieldProps) {
  const [models, setModels] = React.useState<SellBrandModelCatalogRow[]>([])
  const [resolvedBrandSlug, setResolvedBrandSlug] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [requestOpen, setRequestOpen] = React.useState(false)

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

  const effectiveBrandSlug = boardIndexBrandSlug.trim() || resolvedBrandSlug

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

      {!catalogBrandId.trim() ? (
        <div className="rounded-md border border-border/80 bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
          Choose a brand from our directory above to see models for that brand.
        </div>
      ) : loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : (
        <>
          {loading ? (
            <div
              id="listing-board-model-select"
              className="flex min-h-touch w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm text-muted-foreground shadow-xs"
            >
              Loading models…
            </div>
          ) : models.length === 0 ? (
            <>
              <Input
                id="listing-board-model-select"
                className="placeholder:text-muted-foreground/45"
                placeholder="e.g., Rookie — enter model until we add it to the directory"
                value={modelName}
                disabled={disabled}
                onChange={(e) => {
                  const v = e.target.value
                  const slugOut = effectiveBrandSlug.trim()
                  const brandLabel = linkedBrandDisplayName.trim()
                  onCatalogModelChange({
                    boardModelName: v,
                    boardIndexModelSlug: v.trim() ? slugify(v) : "",
                    boardIndexBrandSlug: slugOut,
                    boardIndexLabel:
                      v.trim() && brandLabel ? `${brandLabel} ${v.trim()}`.trim() : brandLabel,
                  })
                }}
                autoComplete="off"
                maxLength={LISTING_BOARD_MODEL_MAX_LENGTH}
              />
              <p className="text-xs text-muted-foreground">
                No models in our catalog for this brand yet — type the model for now, or request we add it.
              </p>
            </>
          ) : (
            <>
              <Select
                disabled={disabled}
                value={selectedModelId}
                onValueChange={(id) => {
                  const slugOut = effectiveBrandSlug.trim()
                  const brandLabel = linkedBrandDisplayName.trim()
                  if (id === UNSELECTED_VALUE) {
                    onCatalogModelChange({
                      boardModelName: "",
                      boardIndexModelSlug: "",
                      boardIndexBrandSlug: slugOut,
                      boardIndexLabel: brandLabel,
                    })
                    return
                  }
                  const row = models.find((m) => m.id === id)
                  if (!row) return
                  onCatalogModelChange({
                    boardModelName: row.name,
                    boardIndexModelSlug: row.catalogSlug,
                    boardIndexBrandSlug: slugOut,
                    boardIndexLabel: `${brandLabel} ${row.name}`.trim(),
                  })
                }}
              >
                <SelectTrigger id="listing-board-model-select" aria-label="Board model" className="min-h-touch w-full">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSELECTED_VALUE}>Select a model</SelectItem>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {showLegacyMismatch ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Your saved model name isn&apos;t in our catalog yet — choose a match below or request we add it.
                </p>
              ) : null}
            </>
          )}

          <button
            type="button"
            className="text-left text-xs text-primary underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50"
            disabled={!catalogBrandId.trim() || Boolean(disabled)}
            onClick={() => setRequestOpen(true)}
          >
            Model not listed? Request we add it
          </button>

          <RequestModelDialog
            open={requestOpen}
            onOpenChange={setRequestOpen}
            brandId={catalogBrandId.trim()}
            brandDisplayName={brandForRequest}
            defaultModelName={modelName.trim()}
          />
        </>
      )}
    </div>
  )
}
