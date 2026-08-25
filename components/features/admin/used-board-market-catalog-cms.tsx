"use client"

import { useCallback, useEffect, useState } from "react"
import { Layers, Plus } from "lucide-react"
import { BrandEditorDialog } from "@/components/brands/brand-editor-dialog"
import { BrandModelEditorDialog } from "@/components/brands/brand-model-editor-dialog"
import { Button } from "@/components/ui/button"

type BrandOption = { id: string; name: string }

interface UsedBoardMarketCatalogCmsProps {
  onSaved?: () => void
}

export function UsedBoardMarketCatalogCms({ onSaved }: UsedBoardMarketCatalogCmsProps) {
  const [brandDialogOpen, setBrandDialogOpen] = useState(false)
  const [modelsDialogOpen, setModelsDialogOpen] = useState(false)
  const [brands, setBrands] = useState<BrandOption[]>([])

  const loadBrands = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/brands", { credentials: "include" })
      const body = (await res.json().catch(() => ({}))) as {
        data?: { rows?: Array<{ id: string; name: string }> }
      }
      setBrands(
        (body.data?.rows ?? []).map((row) => ({ id: row.id, name: row.name })),
      )
    } catch {
      setBrands([])
    }
  }, [])

  useEffect(() => {
    if (brandDialogOpen || modelsDialogOpen) void loadBrands()
  }, [brandDialogOpen, loadBrands, modelsDialogOpen])

  return (
    <>
      <Button size="sm" className="h-9 gap-1.5" onClick={() => setBrandDialogOpen(true)}>
        <Plus className="h-4 w-4" />
        Add brand
      </Button>
      <Button
        size="sm"
        variant="secondary"
        className="h-9 gap-1.5"
        onClick={() => setModelsDialogOpen(true)}
      >
        <Layers className="h-4 w-4" />
        Add models
      </Button>
      <BrandEditorDialog
        open={brandDialogOpen}
        onOpenChange={setBrandDialogOpen}
        mode="create"
        brand={null}
        redirectOnCreate={false}
        onSaved={() => {
          void loadBrands()
          onSaved?.()
        }}
      />
      <BrandModelEditorDialog
        open={modelsDialogOpen}
        onOpenChange={(next) => {
          setModelsDialogOpen(next)
          if (!next) onSaved?.()
        }}
        brands={brands}
      />
    </>
  )
}
