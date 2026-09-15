"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { BrandEditorDialog } from "@/components/brands/brand-editor-dialog"
import { BrandModelEditorDialog } from "@/components/brands/brand-model-editor-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ListingAdminBarSnapshot } from "@/lib/listing-detail-admin-bar"

type BrandOption = { id: string; name: string }

type ModelOption = { id: string; name: string; brand_id: string }

export function ListingDetailAdminCatalogDialogs({
  listing,
  brandOpen,
  onBrandOpenChange,
  modelOpen,
  onModelOpenChange,
  linkOpen,
  onLinkOpenChange,
}: {
  listing: ListingAdminBarSnapshot
  brandOpen: boolean
  onBrandOpenChange: (open: boolean) => void
  modelOpen: boolean
  onModelOpenChange: (open: boolean) => void
  linkOpen: boolean
  onLinkOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [brands, setBrands] = React.useState<BrandOption[]>([])
  const [models, setModels] = React.useState<ModelOption[]>([])
  const [brandId, setBrandId] = React.useState(listing.brandId ?? "")
  const [modelId, setModelId] = React.useState(listing.brandModelId ?? "")
  const [loadingBrands, setLoadingBrands] = React.useState(false)
  const [loadingModels, setLoadingModels] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const loadBrands = React.useCallback(async () => {
    setLoadingBrands(true)
    try {
      const res = await fetch("/api/admin/brands", { credentials: "include" })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { rows?: BrandOption[] }
        error?: string
      }
      if (!res.ok) {
        toast.error(json.error || "Could not load brands")
        return
      }
      setBrands(Array.isArray(json.data?.rows) ? json.data.rows : [])
    } finally {
      setLoadingBrands(false)
    }
  }, [])

  React.useEffect(() => {
    if (modelOpen || linkOpen) void loadBrands()
  }, [linkOpen, loadBrands, modelOpen])

  React.useEffect(() => {
    if (!linkOpen) return
    setBrandId(listing.brandId ?? "")
    setModelId(listing.brandModelId ?? "")
  }, [linkOpen, listing.brandId, listing.brandModelId])

  React.useEffect(() => {
    if (!linkOpen || !brandId) {
      setModels([])
      return
    }
    let cancelled = false
    setLoadingModels(true)
    void (async () => {
      const res = await fetch(
        `/api/admin/brand-models?brand_id=${encodeURIComponent(brandId)}`,
        { credentials: "include" },
      )
      const json = (await res.json().catch(() => ({}))) as {
        data?: { rows?: ModelOption[] }
        error?: string
      }
      if (cancelled) return
      if (!res.ok) {
        toast.error(json.error || "Could not load models")
        setModels([])
      } else {
        setModels(Array.isArray(json.data?.rows) ? json.data.rows : [])
      }
      setLoadingModels(false)
    })()
    return () => {
      cancelled = true
    }
  }, [brandId, linkOpen])

  async function saveLink() {
    if (!brandId && !modelId) {
      toast.error("Choose a brand or model")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/listings/${encodeURIComponent(listing.id)}/brand-model`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_id: brandId || null,
          brand_model_id: modelId || null,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(json.error || "Could not link brand or model")
        return
      }
      toast.success("Listing linked to catalog")
      onLinkOpenChange(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <BrandEditorDialog
        open={brandOpen}
        onOpenChange={onBrandOpenChange}
        mode="create"
        brand={null}
        redirectOnCreate={false}
        initialName={listing.brandId ? undefined : listing.brandLabel ?? undefined}
      />
      <BrandModelEditorDialog open={modelOpen} onOpenChange={onModelOpenChange} brands={brands} />
      <Dialog open={linkOpen} onOpenChange={onLinkOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link brand or model</DialogTitle>
            <DialogDescription>
              Attach this listing to the brand directory
              {listing.brandLabel ? ` (listed as ${listing.brandLabel}` : ""}
              {listing.brandLabel && listing.modelLabel ? ` ${listing.modelLabel}` : ""}
              {listing.brandLabel ? ")" : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="listing-admin-brand">Brand</Label>
              <Select
                value={brandId || undefined}
                onValueChange={(value) => {
                  setBrandId(value)
                  setModelId("")
                }}
                disabled={loadingBrands}
              >
                <SelectTrigger id="listing-admin-brand">
                  <SelectValue placeholder={loadingBrands ? "Loading…" : "Select brand"} />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="listing-admin-model">Model</Label>
              <Select
                value={modelId || undefined}
                onValueChange={setModelId}
                disabled={!brandId || loadingModels}
              >
                <SelectTrigger id="listing-admin-model">
                  <SelectValue
                    placeholder={
                      !brandId ? "Choose a brand first" : loadingModels ? "Loading…" : "Select model"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" className="w-full" disabled={saving} onClick={() => void saveLink()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save catalog link"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
