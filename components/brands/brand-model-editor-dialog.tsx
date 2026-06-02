"use client"

import * as React from "react"
import Image from "next/image"
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ImagePlus,
  Layers,
  Loader2,
  Package,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import type { BrandRow } from "@/lib/brands/types"
import { LISTING_CONDITION_SELL_OPTIONS } from "@/lib/listing-labels"
import {
  BRAND_MODEL_VARIANT_DEFAULT_FIN_BOXES,
  BRAND_MODEL_VARIANT_DEFAULT_MATERIAL,
  type BrandModelVariantCondition,
  type BrandModelVariantMaterial,
  type FinBoxesType,
  type FinBoxType,
} from "@/lib/validations/brand-model-variants"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BrandCatalogImagePickButton } from "@/components/brands/brand-catalog-image-picker-dialog"
import { BrandModelVariantsEditor } from "@/components/brands/brand-model-variants-editor"
import {
  FIN_BOXES_ADMIN_OPTIONS,
  VARIANT_MATERIAL_ADMIN_OPTIONS,
  formatBrandModelVariantLabel,
  parseOptionalPriceInput,
} from "@/lib/utils/brand-model-dimensions"
import { cn } from "@/lib/utils"

const MODEL_IMAGE_MAX = 5 * 1024 * 1024

type BrandOption = Pick<BrandRow, "id" | "name">

type ModelListRow = {
  id: string
  brand_id: string
  name: string
  description: string | null
  image_url: string | null
  brand: { id: string; name: string; slug: string }
}

type PendingVariant = {
  clientId: string
  length_label: string
  width_label: string
  thickness_label: string
  volume_label: string
  fin_box_type: FinBoxType
  fin_boxes: FinBoxesType
  material: BrandModelVariantMaterial
  condition: BrandModelVariantCondition
  price: number | null
  image_url: string | null
}

export function BrandModelEditorDialog({
  open,
  onOpenChange,
  brands,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  brands: BrandOption[]
}) {
  const [brandId, setBrandId] = React.useState<string>("")
  const [modelName, setModelName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [loadingList, setLoadingList] = React.useState(false)
  const [models, setModels] = React.useState<ModelListRow[]>([])
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [brandPickerOpen, setBrandPickerOpen] = React.useState(false)
  const modelImageInputRef = React.useRef<HTMLInputElement>(null)
  const [imagePatchingId, setImagePatchingId] = React.useState<string | null>(null)
  const [expandedModels, setExpandedModels] = React.useState<Record<string, boolean>>({})
  const [modelSearch, setModelSearch] = React.useState("")
  const [pendingCreateVariants, setPendingCreateVariants] = React.useState<PendingVariant[]>([])
  const [createDimL, setCreateDimL] = React.useState("")
  const [createDimW, setCreateDimW] = React.useState("")
  const [createDimT, setCreateDimT] = React.useState("")
  const [createDimV, setCreateDimV] = React.useState("")
  const [createFinBoxType, setCreateFinBoxType] = React.useState<FinBoxType>("futures")
  const [createFinBoxes, setCreateFinBoxes] = React.useState<FinBoxesType>(
    BRAND_MODEL_VARIANT_DEFAULT_FIN_BOXES,
  )
  const [createFoamMaterial, setCreateFoamMaterial] = React.useState<BrandModelVariantMaterial>(
    BRAND_MODEL_VARIANT_DEFAULT_MATERIAL,
  )
  const [createCondition, setCreateCondition] = React.useState<BrandModelVariantCondition>("brand_new")
  const [createPrice, setCreatePrice] = React.useState("")
  const createDimImageRef = React.useRef<HTMLInputElement>(null)
  const [newModelCatalogImageUrl, setNewModelCatalogImageUrl] = React.useState<string | null>(null)
  const [queueVariantCatalogImageUrl, setQueueVariantCatalogImageUrl] = React.useState<string | null>(null)
  /** Popover must portal inside this surface so dialog scroll-lock (`react-remove-scroll`) allows wheel scrolling. */
  const [dialogSurfaceEl, setDialogSurfaceEl] = React.useState<HTMLElement | null>(null)

  const loadModels = React.useCallback(async (bid: string) => {
    if (!bid) {
      setModels([])
      return
    }
    setLoadingList(true)
    try {
      const res = await fetch(`/api/admin/brand-models?brand_id=${encodeURIComponent(bid)}`, {
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as { data?: { rows?: ModelListRow[] }; error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not load models")
        setModels([])
        return
      }
      setModels(json.data?.rows ?? [])
    } finally {
      setLoadingList(false)
    }
  }, [])

  React.useEffect(() => {
    if (!open) {
      setBrandPickerOpen(false)
      return
    }
    setModelName("")
    setDescription("")
    if (modelImageInputRef.current) modelImageInputRef.current.value = ""
    setPendingCreateVariants([])
    setCreateDimL("")
    setCreateDimW("")
    setCreateDimT("")
    setCreateDimV("")
    setCreateFinBoxType("futures")
    setCreatePrice("")
    if (createDimImageRef.current) createDimImageRef.current.value = ""
    setNewModelCatalogImageUrl(null)
    setQueueVariantCatalogImageUrl(null)
    if (brands.length === 1) {
      setBrandId(brands[0].id)
    } else {
      setBrandId("")
    }
    setModels([])
    setExpandedModels({})
    setModelSearch("")
  }, [open, brands])

  const filteredModels = React.useMemo(() => {
    const q = modelSearch.trim().toLowerCase()
    if (!q) return models
    return models.filter((m) => m.name.toLowerCase().includes(q))
  }, [models, modelSearch])

  const selectedBrandName = brandId ? (brands.find((b) => b.id === brandId)?.name ?? null) : null

  React.useEffect(() => {
    if (!open || !brandId) return
    void loadModels(brandId)
  }, [open, brandId, loadModels])

  async function uploadModelImageFile(file: File): Promise<string | null> {
    if (file.size > MODEL_IMAGE_MAX) {
      toast.error("Image must be under 5MB")
      return null
    }
    const supabase = createClient()
    const ext = (file.name.split(".").pop() || "png").toLowerCase()
    const safeExt = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ? ext : "png"
    const path = `board-models/${crypto.randomUUID()}.${safeExt}`
    const { error } = await supabase.storage.from("brand-assets").upload(path, file, { upsert: false })
    if (error) {
      console.error(error)
      toast.error(error.message || "Upload failed")
      return null
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("brand-assets").getPublicUrl(path)
    return `${publicUrl}?t=${Date.now()}`
  }

  async function uploadDimensionImageFile(file: File): Promise<string | null> {
    if (file.size > MODEL_IMAGE_MAX) {
      toast.error("Image must be under 5MB")
      return null
    }
    const supabase = createClient()
    const ext = (file.name.split(".").pop() || "png").toLowerCase()
    const safeExt = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ? ext : "png"
    const path = `board-models/dimensions/${crypto.randomUUID()}.${safeExt}`
    const { error } = await supabase.storage.from("brand-assets").upload(path, file, { upsert: false })
    if (error) {
      console.error(error)
      toast.error(error.message || "Upload failed")
      return null
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("brand-assets").getPublicUrl(path)
    return `${publicUrl}?t=${Date.now()}`
  }

  function handleQueueCreateVariation(e: React.MouseEvent) {
    e.preventDefault()
    const priceParsed = parseOptionalPriceInput(createPrice)
    if (!priceParsed.ok) {
      toast.error(priceParsed.message)
      return
    }
    void (async () => {
      const file = createDimImageRef.current?.files?.[0]
      let imageUrl: string | null = null
      if (file) {
        const uploaded = await uploadDimensionImageFile(file)
        if (!uploaded) return
        imageUrl = uploaded
      } else if (queueVariantCatalogImageUrl) {
        imageUrl = queueVariantCatalogImageUrl
      }
      setPendingCreateVariants((prev) => [
        ...prev,
        {
          clientId: crypto.randomUUID(),
          length_label: createDimL.trim(),
          width_label: createDimW.trim(),
          thickness_label: createDimT.trim(),
          volume_label: createDimV.trim(),
          fin_box_type: createFinBoxType,
          fin_boxes: createFinBoxes,
          material: createFoamMaterial,
          condition: createCondition,
          price: priceParsed.value,
          image_url: imageUrl,
        },
      ])
      setCreateDimL("")
      setCreateDimW("")
      setCreateDimT("")
      setCreateDimV("")
      setCreatePrice("")
      if (createDimImageRef.current) createDimImageRef.current.value = ""
      setQueueVariantCatalogImageUrl(null)
      toast.success("Variant queued — it will save when you click Add model")
    })()
  }

  async function patchModelImage(modelId: string, imageUrl: string | null) {
    setImagePatchingId(modelId)
    try {
      const res = await fetch(`/api/admin/brand-models/${encodeURIComponent(modelId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ image_url: imageUrl }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not update image")
        return
      }
      toast.success(imageUrl ? "Image updated" : "Image removed")
      await loadModels(brandId)
    } finally {
      setImagePatchingId(null)
    }
  }

  async function handleRowImageFile(modelId: string, file: File | undefined) {
    if (!file) return
    const url = await uploadModelImageFile(file)
    if (!url) return
    await patchModelImage(modelId, url)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!brandId) {
      toast.error("Choose a brand")
      return
    }
    const name = modelName.trim()
    if (!name) {
      toast.error("Model name is required")
      return
    }

    setSaving(true)
    try {
      const file = modelImageInputRef.current?.files?.[0]
      let imageUrl: string | null = null
      if (file) {
        const uploaded = await uploadModelImageFile(file)
        if (!uploaded) {
          setSaving(false)
          return
        }
        imageUrl = uploaded
      } else if (newModelCatalogImageUrl) {
        imageUrl = newModelCatalogImageUrl
      }

      const res = await fetch("/api/admin/brand-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          brand_id: brandId,
          name,
          description: description.trim() || null,
          image_url: imageUrl,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { model?: { id: string } }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not save model")
        return
      }
      const newModelId = json.data?.model?.id
      if (!newModelId) {
        toast.error("Model saved but response was invalid")
        return
      }

      const variantErrors: string[] = []
      for (const v of pendingCreateVariants) {
        const vr = await fetch("/api/admin/brand-model-variants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            brand_id: brandId,
            brand_model_id: newModelId,
            length_label: v.length_label,
            width_label: v.width_label,
            thickness_label: v.thickness_label,
            volume_label: v.volume_label,
            fin_box_type: v.fin_box_type,
            fin_boxes: v.fin_boxes,
            material: v.material,
            condition: v.condition,
            price: v.price,
            image_url: v.image_url,
          }),
        })
        const vj = (await vr.json().catch(() => ({}))) as { error?: string }
        if (!vr.ok) {
          variantErrors.push(typeof vj.error === "string" ? vj.error : "Unknown error")
        }
      }

      if (variantErrors.length > 0) {
        toast.error(
          `Model added, but ${variantErrors.length} variant(s) failed: ${variantErrors[0] ?? ""}`,
        )
      } else {
        toast.success(pendingCreateVariants.length > 0 ? "Model and variants added" : "Model added")
      }
      setModelName("")
      setDescription("")
      if (modelImageInputRef.current) modelImageInputRef.current.value = ""
      setNewModelCatalogImageUrl(null)
      setPendingCreateVariants([])
      setCreateDimL("")
      setCreateDimW("")
      setCreateDimT("")
      setCreateDimV("")
      setCreateFinBoxType("futures")
      setCreateFinBoxes(BRAND_MODEL_VARIANT_DEFAULT_FIN_BOXES)
      setCreateFoamMaterial(BRAND_MODEL_VARIANT_DEFAULT_MATERIAL)
      setCreateCondition("brand_new")
      setCreatePrice("")
      if (createDimImageRef.current) createDimImageRef.current.value = ""
      await loadModels(brandId)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/brand-models/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not delete")
        return
      }
      toast.success("Model removed")
      await loadModels(brandId)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={setDialogSurfaceEl}
        className={cn(
          "left-0 top-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-none sm:rounded-none",
          "data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:slide-out-to-bottom-2",
        )}
        onPointerDownOutside={(e) => {
          const t = e.target as HTMLElement | null
          // Popover content is portaled outside the dialog node; without this, Radix treats
          // clicks on the brand list as “outside” the dialog and the selection never applies.
          if (t?.closest("[data-brand-model-picker]") || t?.closest("[data-brand-catalog-image-picker]")) {
            e.preventDefault()
          }
        }}
        onFocusOutside={(e) => {
          const t = e.target as HTMLElement | null
          if (t?.closest("[data-brand-model-picker]") || t?.closest("[data-brand-catalog-image-picker]")) {
            e.preventDefault()
          }
        }}
      >
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 px-4 pb-5 pt-12 text-white sm:px-6 sm:pt-14">
          <DialogHeader className="space-y-4 text-left">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80">
                <Sparkles className="h-3 w-3" />
                Pro · Catalog CMS
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15">
                  <Layers className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <DialogTitle className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                    Board models
                  </DialogTitle>
                  <DialogDescription className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-300">
                    Build the catalog per brand: add a model, then queue sizes and fin setups (Futures, FCS, or single
                    fin). Model names are unique within each brand.
                  </DialogDescription>
                </div>
              </div>
            </div>
            <div className="max-w-md space-y-2">
              <Label
                htmlFor="brand-model-brand-trigger"
                className="text-[11px] font-semibold uppercase tracking-wider text-white/70"
              >
                Brand
              </Label>
              <Popover open={brandPickerOpen} onOpenChange={setBrandPickerOpen} modal={false}>
                <PopoverTrigger asChild>
                  <Button
                    id="brand-model-brand-trigger"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={brandPickerOpen}
                    disabled={brands.length === 0}
                    className="h-11 w-full justify-between border-border/80 bg-background font-normal shadow-sm"
                  >
                    <span
                      className={cn(
                        "truncate text-left",
                        !brandId && "text-muted-foreground",
                      )}
                    >
                      {brandId
                        ? (brands.find((b) => b.id === brandId)?.name ?? "Select brand")
                        : brands.length
                          ? "Search or select brand…"
                          : "No brands in directory"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  data-brand-model-picker
                  portalContainer={dialogSurfaceEl}
                  className="z-[100] w-[var(--radix-popover-trigger-width)] min-w-[min(100vw-2rem,22rem)] p-0"
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  {/*
                    Popovers inside full-screen dialogs: Command defaults to h-full while the
                    popper has no definite height, so the list grew to full content height and
                    never scrolled. Cap Command height and let the list flex + min-h-0 consume
                    the remainder so overflow-y-auto applies.
                  */}
                  <Command className="h-auto max-h-[min(340px,50vh)]">
                    <CommandInput placeholder="Search brands…" />
                    <CommandList className="max-h-none min-h-0 flex-1 overflow-y-scroll overscroll-contain [touch-action:pan-y]">
                      <CommandEmpty>No brand found.</CommandEmpty>
                      <CommandGroup>
                        {brands.map((b) => (
                          <CommandItem
                            key={b.id}
                            value={`${b.name} ${b.id}`}
                            onSelect={() => {
                              setBrandId(b.id)
                              setBrandPickerOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                brandId === b.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="truncate">{b.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </DialogHeader>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="flex min-h-0 w-full flex-col border-b border-border/60 bg-background lg:w-[min(100%,430px)] lg:shrink-0 lg:border-b-0 lg:border-r lg:border-border/60 xl:w-[440px]">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              <div className="mb-6 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Package className="h-5 w-5" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm font-semibold text-foreground">Add a model</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Hero image and notes are optional. Queue variants below or add them later from the list.
                  </p>
                </div>
              </div>
              <form id="brand-model-create-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="brand-model-name">Model name</Label>
            <Input
              id="brand-model-name"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g. Plasmic"
              autoComplete="off"
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand-model-desc">Description (optional)</Label>
            <Textarea
              id="brand-model-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Short notes for internal reference"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand-model-image">Model image (optional)</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <Input
                id="brand-model-image"
                ref={modelImageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={() => setNewModelCatalogImageUrl(null)}
                className="min-h-10 flex-1 cursor-pointer text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
              <BrandCatalogImagePickButton
                brandId={brandId}
                portalContainer={dialogSurfaceEl}
                disabled={saving || !brandId}
                title="Choose a model or variant photo from this brand"
                onSelected={(url) => {
                  setNewModelCatalogImageUrl(url)
                  if (modelImageInputRef.current) modelImageInputRef.current.value = ""
                }}
                className="shrink-0"
              />
            </div>
            {newModelCatalogImageUrl ? (
              <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-2">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border/40">
                  <Image src={newModelCatalogImageUrl} alt="" fill className="object-cover" sizes="56px" />
                </div>
                <p className="min-w-0 flex-1 text-xs text-muted-foreground">Using catalog image. Upload a file above to replace.</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 text-xs"
                  disabled={saving}
                  onClick={() => setNewModelCatalogImageUrl(null)}
                >
                  Clear
                </Button>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP, or GIF — max 5MB. Stored in brand assets.</p>
          </div>

          <Separator className="bg-border/60" />
          <div className="space-y-4 rounded-xl border border-border/60 bg-muted/15 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm ring-1 ring-border/50">
                <Layers className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Variant queue (optional)</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  One entry per size, fin plugs, boxes, foam, and condition. Same dimensions can repeat when other
                  fields differ. Saved when you create the model.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="create-fin" className="text-xs">
                  Fin plugs
                </Label>
                <Select
                  value={createFinBoxType}
                  onValueChange={(v) => setCreateFinBoxType(v as FinBoxType)}
                  disabled={saving || !brandId}
                >
                  <SelectTrigger id="create-fin" className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="futures">Futures</SelectItem>
                    <SelectItem value="fcs">FCS</SelectItem>
                    <SelectItem value="single_fin">Single fin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="create-fboxes" className="text-xs">
                  Fin boxes
                </Label>
                <Select
                  value={createFinBoxes}
                  onValueChange={(v) => setCreateFinBoxes(v as FinBoxesType)}
                  disabled={saving || !brandId}
                >
                  <SelectTrigger id="create-fboxes" className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {FIN_BOXES_ADMIN_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="create-foam" className="text-xs">
                  Material
                </Label>
                <Select
                  value={createFoamMaterial}
                  onValueChange={(v) => setCreateFoamMaterial(v as BrandModelVariantMaterial)}
                  disabled={saving || !brandId}
                >
                  <SelectTrigger id="create-foam" className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VARIANT_MATERIAL_ADMIN_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="create-cond" className="text-xs">
                  Condition
                </Label>
                <Select
                  value={createCondition}
                  onValueChange={(v) => setCreateCondition(v as BrandModelVariantCondition)}
                  disabled={saving || !brandId}
                >
                  <SelectTrigger id="create-cond" className="h-9 text-sm">
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
                <Label htmlFor="create-dim-l" className="text-xs">
                  Length
                </Label>
                <Input
                  id="create-dim-l"
                  value={createDimL}
                  onChange={(e) => setCreateDimL(e.target.value)}
                  placeholder="5'6"
                  autoComplete="off"
                  disabled={saving || !brandId}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-dim-w" className="text-xs">
                  Width
                </Label>
                <Input
                  id="create-dim-w"
                  value={createDimW}
                  onChange={(e) => setCreateDimW(e.target.value)}
                  placeholder="19 1/4"
                  autoComplete="off"
                  disabled={saving || !brandId}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-dim-t" className="text-xs">
                  Thickness
                </Label>
                <Input
                  id="create-dim-t"
                  value={createDimT}
                  onChange={(e) => setCreateDimT(e.target.value)}
                  placeholder="2 3/8"
                  autoComplete="off"
                  disabled={saving || !brandId}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-dim-v" className="text-xs">
                  Volume
                </Label>
                <Input
                  id="create-dim-v"
                  value={createDimV}
                  onChange={(e) => setCreateDimV(e.target.value)}
                  placeholder="29.5 L"
                  autoComplete="off"
                  disabled={saving || !brandId}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="create-price" className="text-xs">
                Price (USD, optional)
              </Label>
              <Input
                id="create-price"
                value={createPrice}
                onChange={(e) => setCreatePrice(e.target.value)}
                placeholder="895"
                inputMode="decimal"
                autoComplete="off"
                disabled={saving || !brandId}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
              <Label htmlFor="create-dim-img" className="text-xs">
                Image for this size (optional)
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="create-dim-img"
                  ref={createDimImageRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={saving || !brandId}
                  onChange={() => setQueueVariantCatalogImageUrl(null)}
                  className="h-9 min-w-0 flex-1 cursor-pointer text-sm file:mr-2 file:text-xs"
                />
                <BrandCatalogImagePickButton
                  brandId={brandId}
                  portalContainer={dialogSurfaceEl}
                  disabled={saving || !brandId}
                  title="Choose a photo from this brand’s catalog"
                  onSelected={(url) => {
                    setQueueVariantCatalogImageUrl(url)
                    if (createDimImageRef.current) createDimImageRef.current.value = ""
                  }}
                  className="w-full shrink-0 sm:w-auto"
                />
              </div>
              {queueVariantCatalogImageUrl ? (
                <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-2 py-1.5">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                    <Image src={queueVariantCatalogImageUrl} alt="" fill className="object-cover" sizes="40px" />
                  </div>
                  <span className="text-[11px] text-muted-foreground">Catalog image selected · upload to replace</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 text-[11px]"
                    disabled={saving}
                    onClick={() => setQueueVariantCatalogImageUrl(null)}
                  >
                    Clear
                  </Button>
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto"
              disabled={saving || !brandId}
              onClick={handleQueueCreateVariation}
            >
              Add to queue
            </Button>
            {pendingCreateVariants.length > 0 ? (
              <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60 bg-card text-sm shadow-sm">
                {pendingCreateVariants.map((v, i) => (
                  <li key={v.clientId} className="flex items-start gap-3 p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 pt-0.5 font-medium leading-snug text-foreground">
                      {formatBrandModelVariantLabel(v)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Remove from queue"
                      disabled={saving}
                      onClick={() => setPendingCreateVariants((prev) => prev.filter((x) => x.clientId !== v.clientId))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
              </form>
            </div>
            <div className="shrink-0 border-t border-border/60 bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
              <Button
                type="submit"
                form="brand-model-create-form"
                className="w-full sm:w-auto"
                size="lg"
                disabled={saving || !brandId}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save model"
                )}
              </Button>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {!brandId
                  ? "Select a brand above to save."
                  : pendingCreateVariants.length > 0
                    ? `${pendingCreateVariants.length} queued variant${pendingCreateVariants.length === 1 ? "" : "s"} will be created with this model.`
                    : "Tip: expand a model on the right to add sizes and fin options anytime."}
              </p>
            </div>
          </aside>

          <section className="flex min-h-0 flex-1 flex-col bg-muted/15">
            <div className="shrink-0 space-y-3 border-b border-border/50 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h2 className="text-sm font-semibold text-foreground">Saved models</h2>
                  {selectedBrandName ? (
                    <span className="text-sm text-muted-foreground">· {selectedBrandName}</span>
                  ) : null}
                  {brandId && !loadingList && models.length > 0 ? (
                    <Badge variant="secondary" className="font-normal tabular-nums">
                      {modelSearch.trim()
                        ? `${filteredModels.length} of ${models.length}`
                        : `${models.length} model${models.length === 1 ? "" : "s"}`}
                    </Badge>
                  ) : null}
                </div>
                {brandId && models.length > 0 ? (
                  <div className="relative w-full lg:max-w-[280px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder="Filter by name…"
                      className="h-9 pl-9"
                      aria-label="Filter models by name"
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              {!brandId ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/60 px-6 py-14 text-center">
                  <Package className="mb-3 h-11 w-11 text-muted-foreground/45" />
                  <p className="text-sm font-medium text-foreground">Choose a brand</p>
                  <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
                    Pick a brand above to load its models and add new ones to the catalog.
                  </p>
                </div>
              ) : loadingList ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin opacity-60" />
                  Loading models…
                </div>
              ) : models.length === 0 ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/60 px-6 py-14 text-center">
                  <Package className="mb-3 h-11 w-11 text-muted-foreground/45" />
                  <p className="text-sm font-medium text-foreground">No models for this brand yet</p>
                  <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
                    Use the left panel to add the first model. You can queue variants before saving or edit them later.
                  </p>
                </div>
              ) : filteredModels.length === 0 ? (
                <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-border/60 bg-background/50 px-6 py-10 text-center">
                  <Search className="mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No models match <span className="font-medium text-foreground">“{modelSearch.trim()}”</span>
                  </p>
                  <Button type="button" variant="link" className="mt-1 h-auto p-0 text-xs" onClick={() => setModelSearch("")}>
                    Clear filter
                  </Button>
                </div>
              ) : (
                <ul className="space-y-3 pb-10">
                  {filteredModels.map((m) => {
                    const expanded = expandedModels[m.id] === true
                    return (
                      <li
                        key={m.id}
                        className={cn(
                          "overflow-hidden rounded-xl border bg-card shadow-sm ring-1 ring-border/40 transition-shadow",
                          expanded && "ring-2 ring-primary/20 shadow-md",
                        )}
                      >
                        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-stretch sm:gap-4 sm:p-4">
                          <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="mt-0.5 h-10 w-10 shrink-0 rounded-lg"
                              aria-expanded={expanded}
                              aria-label={expanded ? `Collapse ${m.name}` : `Expand ${m.name} to edit variants`}
                              disabled={deletingId === m.id}
                              onClick={() => setExpandedModels((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                            >
                              {expanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border/30">
                              {m.image_url ? (
                                <Image
                                  src={m.image_url}
                                  alt=""
                                  fill
                                  className="object-cover"
                                  sizes="64px"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] leading-tight text-muted-foreground">
                                  No photo
                                </div>
                              )}
                              {m.image_url ? (
                                <button
                                  type="button"
                                  className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-md bg-background/95 text-muted-foreground shadow-sm hover:text-destructive"
                                  aria-label={`Remove image for ${m.name}`}
                                  disabled={imagePatchingId === m.id || deletingId === m.id}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void patchModelImage(m.id, null)
                                  }}
                                >
                                  {imagePatchingId === m.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <X className="h-3 w-3" />
                                  )}
                                </button>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="min-w-0 flex-1 rounded-lg py-0.5 text-left outline-none ring-offset-background hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() =>
                                setExpandedModels((prev) => ({ ...prev, [m.id]: !prev[m.id] }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault()
                                  setExpandedModels((prev) => ({ ...prev, [m.id]: !prev[m.id] }))
                                }
                              }}
                            >
                              <p className="text-base font-semibold leading-tight text-foreground">{m.name}</p>
                              {m.description ? (
                                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                  {m.description}
                                </p>
                              ) : (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {expanded ? "Editing variants below" : "Click to manage sizes & fin options"}
                                </p>
                              )}
                            </button>
                          </div>
                          <div
                            className="flex shrink-0 flex-row items-center justify-end gap-2 sm:flex-col sm:items-end sm:justify-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              id={`brand-model-row-image-${m.id}`}
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              className="sr-only"
                              disabled={imagePatchingId === m.id || deletingId === m.id}
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                e.target.value = ""
                                void handleRowImageFile(m.id, f)
                              }}
                            />
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <BrandCatalogImagePickButton
                                brandId={m.brand_id}
                                focusBrandModelId={m.id}
                                portalContainer={dialogSurfaceEl}
                                disabled={imagePatchingId === m.id || deletingId === m.id}
                                title={`Choose a catalog photo for ${m.name}`}
                                label="Catalog"
                                onSelected={(url) => void patchModelImage(m.id, url)}
                                className="h-9"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 gap-1.5 text-xs"
                                disabled={imagePatchingId === m.id || deletingId === m.id}
                                onClick={() => document.getElementById(`brand-model-row-image-${m.id}`)?.click()}
                              >
                                {imagePatchingId === m.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <ImagePlus className="h-3.5 w-3.5" />
                                )}
                                {m.image_url ? "Replace" : "Add photo"}
                              </Button>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              aria-label={`Delete ${m.name}`}
                              disabled={deletingId === m.id || imagePatchingId === m.id}
                              onClick={() => handleDelete(m.id)}
                            >
                              {deletingId === m.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        {expanded ? (
                          <div className="border-t border-border/60 bg-muted/20 px-3 py-3 sm:px-4 sm:py-4">
                            <BrandModelVariantsEditor
                              brandId={m.brand_id}
                              brandModelId={m.id}
                              modelName={m.name}
                              portalContainer={dialogSurfaceEl}
                              disabled={deletingId === m.id || imagePatchingId === m.id}
                              onReload={async () => {
                                await loadModels(brandId)
                              }}
                            />
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
