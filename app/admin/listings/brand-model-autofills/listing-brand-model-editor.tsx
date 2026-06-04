"use client"

import { useEffect, useState } from "react"
import type { SellBrandModelCatalogRow } from "@/app/actions/marketplace"
import {
  BoardsBrowseCatalogBrandModel,
  prefetchBoardsBrowseBrandModelsCatalog,
} from "@/components/boards-browse-catalog-brand-model"
import { Button } from "@/components/ui/button"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"

export type ListingBrandModelEditorInitial = {
  brandText: string
  catalogBrandId: string
  modelText: string
  catalogModelId: string
  needsBrand: boolean
  needsModel: boolean
}

type SavePayload = { brand_id?: string; brand_model_id?: string }

export function ListingBrandModelEditor({
  listingId,
  initial,
  onSaved,
  onCancel,
  compact = false,
}: {
  listingId: string
  initial: ListingBrandModelEditorInitial
  onSaved: (result: {
    brandId: string | null
    brandModelId: string | null
    brand: string | null
    model: string | null
  }) => void
  onCancel?: () => void
  compact?: boolean
}) {
  const [brandText, setBrandText] = useState(initial.brandText)
  const [catalogBrandId, setCatalogBrandId] = useState(initial.catalogBrandId)
  const [modelText, setModelText] = useState(initial.modelText)
  const [catalogModelId, setCatalogModelId] = useState(initial.catalogModelId)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    prefetchBoardsBrowseBrandModelsCatalog()
  }, [])

  useEffect(() => {
    setBrandText(initial.brandText)
    setCatalogBrandId(initial.catalogBrandId)
    setModelText(initial.modelText)
    setCatalogModelId(initial.catalogModelId)
  }, [initial])

  function buildPayload(): SavePayload | null {
    if (catalogModelId.trim()) {
      return { brand_model_id: catalogModelId.trim() }
    }
    if (catalogBrandId.trim()) {
      return { brand_id: catalogBrandId.trim() }
    }
    return null
  }

  async function handleSave() {
    const payload = buildPayload()
    if (!payload) {
      if (initial.needsBrand && initial.needsModel) {
        toast.error("Pick a catalog brand and model")
      } else if (initial.needsBrand) {
        toast.error("Pick a catalog brand from the directory")
      } else {
        toast.error("Pick a catalog model from the directory")
      }
      return
    }

    setSaving(true)
    try {
      const res = await fetch(
        `/api/admin/listings/${encodeURIComponent(listingId)}/brand-model`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        data?: {
          brandId: string | null
          brandModelId: string | null
          brand: string | null
          model: string | null
        }
      }
      if (!res.ok || !json.data) {
        toast.error(json.error || "Could not save")
        return
      }
      toast.success("Catalog brand/model saved on listing")
      onSaved(json.data)
    } catch {
      toast.error("Could not save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4 rounded-xl border border-border bg-muted/30 p-4"}>
      <BoardsBrowseCatalogBrandModel
        brandText={brandText}
        catalogBrandId={catalogBrandId}
        modelText={modelText}
        onBrandTextChange={setBrandText}
        onCatalogBrandPicked={(b) => {
          setBrandText(b.name)
          setCatalogBrandId(b.id)
        }}
        onModelTextChange={(next) => {
          setModelText(next)
          if (!next.trim()) setCatalogModelId("")
        }}
        onCatalogModelPicked={(row: SellBrandModelCatalogRow) => {
          setModelText(row.name)
          setCatalogModelId(row.id)
          setCatalogBrandId(row.brandId)
          setBrandText(row.brandName)
        }}
        showLabels
        portaledModelDropdown
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
          {saving ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          Save to listing
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function listingBrandModelEditorInitialFromUnmatched(row: {
  needsBrand: boolean
  needsModel: boolean
  matchedBrandName: string | null
  matchedBrandId: string | null
  currentBrand: string | null
  currentModel: string | null
  currentBrandId: string | null
  currentBrandModelId: string | null
}): ListingBrandModelEditorInitial {
  const brandId = row.currentBrandId?.trim() || row.matchedBrandId?.trim() || ""
  const brandText = row.currentBrand?.trim() || row.matchedBrandName?.trim() || ""
  return {
    brandText,
    catalogBrandId: brandId,
    modelText: row.currentModel?.trim() || "",
    catalogModelId: row.currentBrandModelId?.trim() || "",
    needsBrand: row.needsBrand,
    needsModel: row.needsModel,
  }
}

export function listingBrandModelEditorInitialFromAutofill(row: {
  currentBrand: string | null
  currentModel: string | null
  currentBrandId: string | null
  currentBrandModelId: string | null
  brandName: string | null
  modelName: string | null
}): ListingBrandModelEditorInitial {
  return {
    brandText: row.currentBrand?.trim() || row.brandName?.trim() || "",
    catalogBrandId: row.currentBrandId?.trim() || "",
    modelText: row.currentModel?.trim() || row.modelName?.trim() || "",
    catalogModelId: row.currentBrandModelId?.trim() || "",
    needsBrand: !row.currentBrandId,
    needsModel: !row.currentBrandModelId,
  }
}
