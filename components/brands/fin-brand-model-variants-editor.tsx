"use client"

import * as React from "react"
import Image from "next/image"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BrandCatalogImagePickButton } from "@/components/brands/brand-catalog-image-picker-dialog"
import { FIN_CATALOG_PRODUCT_CATEGORY } from "@/lib/brand-catalog-fin-variants"
import { LISTING_CONDITION_SELL_OPTIONS } from "@/lib/listing-labels"
import {
  FIN_SETUP_OPTIONS,
  FIN_SYSTEM_OPTIONS_FOR_FINS,
  FIN_SIZE_OPTIONS,
} from "@/lib/fin-listing-config"
import {
  BRAND_MODEL_VARIANT_DEFAULT_FIN_BOXES,
  FIN_CATALOG_FOIL_OPTIONS,
  FIN_CATALOG_COLOR_OPTIONS,
  type BrandModelVariantCondition,
  type FinBoxesType,
  type FinBoxType,
  type FinCatalogVariantSize,
} from "@/lib/validations/brand-model-variants"
import {
  formatFinCatalogGeometrySummary,
  formatFinCatalogVariantLabel,
} from "@/lib/utils/fin-catalog-variant-label"
import { parseOptionalPriceInput } from "@/lib/utils/brand-model-dimensions"
import { cn } from "@/lib/utils"

type FinVariantRow = {
  id: string
  fin_size: FinCatalogVariantSize | null
  configuration_label: string
  fin_base_label: string
  fin_height_label: string
  fin_foil_label: string
  fin_color_label: string
  fin_box_type: FinBoxType
  fin_boxes: FinBoxesType
  condition: BrandModelVariantCondition
  price: number | null
  image_url: string | null
}

const UNSELECTED_SIZE = "__unspecified__"

export function FinBrandModelVariantsEditor({
  brandId,
  brandModelId,
  modelName,
  disabled,
  portalContainer,
  onReload,
}: {
  brandId: string
  brandModelId: string
  modelName: string
  disabled?: boolean
  portalContainer?: HTMLElement | null
  onReload: () => Promise<void>
}) {
  const [loading, setLoading] = React.useState(true)
  const [rows, setRows] = React.useState<FinVariantRow[]>([])
  const [saving, setSaving] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [finSize, setFinSize] = React.useState<string>("")
  const [configurationLabel, setConfigurationLabel] = React.useState("")
  const [baseLabel, setBaseLabel] = React.useState("")
  const [heightLabel, setHeightLabel] = React.useState("")
  const [foilLabel, setFoilLabel] = React.useState("")
  const [colorLabel, setColorLabel] = React.useState("")
  const [finSystem, setFinSystem] = React.useState<FinBoxType>("fcs_ii")
  const [finSetup, setFinSetup] = React.useState<FinBoxesType>(BRAND_MODEL_VARIANT_DEFAULT_FIN_BOXES)
  const [condition, setCondition] = React.useState<BrandModelVariantCondition>("brand_new")
  const [priceText, setPriceText] = React.useState("")
  const [stagedImageUrl, setStagedImageUrl] = React.useState<string | null>(null)
  const [editId, setEditId] = React.useState<string | null>(null)

  const loadVariants = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/admin/brand-model-variants?brand_model_id=${encodeURIComponent(brandModelId)}`,
        { credentials: "include" },
      )
      const json = (await res.json().catch(() => ({}))) as {
        data?: { rows?: FinVariantRow[] }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not load fin variants")
        setRows([])
        return
      }
      setRows(json.data?.rows ?? [])
    } finally {
      setLoading(false)
    }
  }, [brandModelId])

  React.useEffect(() => {
    void loadVariants()
  }, [loadVariants])

  const resetForm = () => {
    setFinSize("")
    setConfigurationLabel("")
    setBaseLabel("")
    setHeightLabel("")
    setFoilLabel("")
    setColorLabel("")
    setFinSystem("fcs_ii")
    setFinSetup(BRAND_MODEL_VARIANT_DEFAULT_FIN_BOXES)
    setCondition("brand_new")
    setPriceText("")
    setStagedImageUrl(null)
    setEditId(null)
  }

  const buildPayload = () => {
    const priceParsed = parseOptionalPriceInput(priceText)
    if (!priceParsed.ok) {
      toast.error(priceParsed.message)
      return null
    }
    return {
      brand_model_id: brandModelId,
      brand_id: brandId,
      product_category_slug: FIN_CATALOG_PRODUCT_CATEGORY,
      length_label: "",
      width_label: "",
      thickness_label: "",
      volume_label: "",
      fin_size: finSize.trim() ? (finSize as FinCatalogVariantSize) : null,
      configuration_label: configurationLabel.trim(),
      fin_base_label: baseLabel.trim(),
      fin_height_label: heightLabel.trim(),
      fin_foil_label: foilLabel.trim(),
      fin_color_label: colorLabel.trim(),
      fin_box_type: finSystem,
      fin_boxes: finSetup,
      material: "other" as const,
      condition,
      price: priceParsed.value,
      image_url: stagedImageUrl,
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled || saving) return
    const payload = buildPayload()
    if (!payload) return

    setSaving(true)
    try {
      const url = editId ? `/api/admin/brand-model-variants/${editId}` : "/api/admin/brand-model-variants"
      const res = await fetch(url, {
        method: editId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editId
            ? {
                fin_size: payload.fin_size,
                configuration_label: payload.configuration_label,
                fin_base_label: payload.fin_base_label,
                fin_height_label: payload.fin_height_label,
                fin_foil_label: payload.fin_foil_label,
                fin_color_label: payload.fin_color_label,
                fin_box_type: payload.fin_box_type,
                fin_boxes: payload.fin_boxes,
                condition: payload.condition,
                price: payload.price,
                image_url: payload.image_url,
              }
            : payload,
        ),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not save fin variant")
        return
      }
      toast.success(editId ? "Fin variant updated" : "Fin variant added")
      resetForm()
      await loadVariants()
      await onReload()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (disabled || deletingId) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/brand-model-variants/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not delete variant")
        return
      }
      toast.success("Fin variant removed")
      if (editId === id) resetForm()
      await loadVariants()
      await onReload()
    } finally {
      setDeletingId(null)
    }
  }

  const startEdit = (row: FinVariantRow) => {
    setEditId(row.id)
    setFinSize(row.fin_size ?? "")
    setConfigurationLabel(row.configuration_label)
    setBaseLabel(row.fin_base_label ?? "")
    setHeightLabel(row.fin_height_label ?? "")
    setFoilLabel(row.fin_foil_label ?? "")
    setColorLabel(row.fin_color_label ?? "")
    setFinSystem(row.fin_box_type)
    setFinSetup(row.fin_boxes)
    setCondition(row.condition)
    setPriceText(row.price != null ? String(row.price) : "")
    setStagedImageUrl(row.image_url)
  }

  const formDisabled = disabled || saving || loading

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Fin configurations for <span className="font-medium text-foreground">{modelName}</span> — template
        geometry (base, height, foil), color, size, setup, and system.
      </p>

      <form onSubmit={handleSubmit} className="rounded-lg border border-border/70 bg-background p-3 sm:p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {editId ? "Edit fin variant" : "Add fin variant"}
        </p>
        <div className="mb-4 space-y-3 rounded-lg border border-border/60 bg-muted/15 p-3">
          <p className="text-xs font-semibold text-foreground">Template geometry</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Base</Label>
              <Input
                value={baseLabel}
                onChange={(e) => setBaseLabel(e.target.value)}
                placeholder={'5.05"'}
                disabled={formDisabled}
                className="h-9 text-sm"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Height</Label>
              <Input
                value={heightLabel}
                onChange={(e) => setHeightLabel(e.target.value)}
                placeholder={'5.63"'}
                disabled={formDisabled}
                className="h-9 text-sm"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Foil</Label>
              <Input
                value={foilLabel}
                onChange={(e) => setFoilLabel(e.target.value)}
                placeholder="Flat"
                disabled={formDisabled}
                className="h-9 text-sm"
                autoComplete="off"
                list={`fin-foil-options-${brandModelId}`}
              />
              <datalist id={`fin-foil-options-${brandModelId}`}>
                {FIN_CATALOG_FOIL_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
            </div>
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Stored as entered — e.g. Base: 5.05&quot; · Height: 5.63&quot; · Foil: Flat
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Size</Label>
            <Select
              value={finSize.trim() ? finSize : UNSELECTED_SIZE}
              onValueChange={(v) => setFinSize(v === UNSELECTED_SIZE ? "" : v)}
              disabled={formDisabled}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Not specified" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSELECTED_SIZE}>Not specified</SelectItem>
                {FIN_SIZE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fin setup</Label>
            <Select value={finSetup} onValueChange={(v) => setFinSetup(v as FinBoxesType)} disabled={formDisabled}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIN_SETUP_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fin system</Label>
            <Select value={finSystem} onValueChange={(v) => setFinSystem(v as FinBoxType)} disabled={formDisabled}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIN_SYSTEM_OPTIONS_FOR_FINS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Configuration (optional)</Label>
            <Input
              value={configurationLabel}
              onChange={(e) => setConfigurationLabel(e.target.value)}
              placeholder="e.g. Center fin, Side bite, Set of 3"
              disabled={formDisabled}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Color</Label>
            <Input
              value={colorLabel}
              onChange={(e) => setColorLabel(e.target.value)}
              placeholder="e.g. Black, Smoke, Volcanic"
              disabled={formDisabled}
              className="h-9 text-sm"
              autoComplete="off"
              list={`fin-color-options-${brandModelId}`}
            />
            <datalist id={`fin-color-options-${brandModelId}`}>
              {FIN_CATALOG_COLOR_OPTIONS.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Condition</Label>
            <Select
              value={condition}
              onValueChange={(v) => setCondition(v as BrandModelVariantCondition)}
              disabled={formDisabled}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LISTING_CONDITION_SELL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">MSRP (USD, optional)</Label>
            <Input
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              placeholder="120"
              inputMode="decimal"
              disabled={formDisabled}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <Label className="text-xs">Photo (optional)</Label>
            <BrandCatalogImagePickButton
              brandId={brandId}
              focusBrandModelId={brandModelId}
              portalContainer={portalContainer}
              disabled={formDisabled}
              title={`Choose a catalog photo for ${modelName}`}
              label="Pick from catalog"
              onSelected={(url) => setStagedImageUrl(url)}
              className="h-9"
            />
            {stagedImageUrl ? (
              <div className="mt-2 flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-2">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                  <Image src={stagedImageUrl} alt="" fill className="object-cover" sizes="48px" />
                </div>
                <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setStagedImageUrl(null)}>
                  Clear photo
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit" size="sm" className="gap-1.5" disabled={formDisabled}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editId ? "Save changes" : "Add fin variant"}
          </Button>
          {editId ? (
            <Button type="button" variant="ghost" size="sm" disabled={formDisabled} onClick={resetForm}>
              Cancel edit
            </Button>
          ) : null}
        </div>
      </form>

      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Saved fin variants</p>
        {loading ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
            No fin variants yet. Add size, setup, and system above.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5",
                  editId === row.id && "border-cerulean/40 bg-cerulean/[0.04]",
                )}
              >
                <div className="min-w-0">
                  {formatFinCatalogGeometrySummary({
                    fin_base_label: row.fin_base_label,
                    fin_height_label: row.fin_height_label,
                    fin_foil_label: row.fin_foil_label,
                  }) ? (
                    <p className="text-sm font-medium text-foreground">
                      {formatFinCatalogGeometrySummary({
                        fin_base_label: row.fin_base_label,
                        fin_height_label: row.fin_height_label,
                        fin_foil_label: row.fin_foil_label,
                      })}
                    </p>
                  ) : null}
                  <p
                    className={cn(
                      "text-sm text-foreground",
                      formatFinCatalogGeometrySummary({
                        fin_base_label: row.fin_base_label,
                        fin_height_label: row.fin_height_label,
                        fin_foil_label: row.fin_foil_label,
                      })
                        ? "mt-1 text-xs text-muted-foreground"
                        : "font-medium",
                    )}
                  >
                    {formatFinCatalogVariantLabel({
                      fin_size: row.fin_size,
                      configuration_label: row.configuration_label,
                      fin_color_label: row.fin_color_label,
                      fin_box_type: row.fin_box_type,
                      fin_boxes: row.fin_boxes,
                      fin_base_label: "",
                      fin_height_label: "",
                      fin_foil_label: "",
                    })}
                  </p>
                  {row.price != null && row.price > 0 ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">${row.price.toFixed(2)} MSRP</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Edit fin variant"
                    disabled={formDisabled || deletingId === row.id}
                    onClick={() => startEdit(row)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    aria-label="Delete fin variant"
                    disabled={formDisabled || deletingId === row.id}
                    onClick={() => void handleDelete(row.id)}
                  >
                    {deletingId === row.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
