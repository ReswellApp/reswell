"use client"

import * as React from "react"
import Image from "next/image"
import { Copy, ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { FinBoxType } from "@/lib/validations/brand-model-variants"
import { formatBrandModelVariantLabel } from "@/lib/utils/brand-model-dimensions"
import { cn } from "@/lib/utils"

const DIM_IMAGE_MAX = 5 * 1024 * 1024

type VariantRow = {
  id: string
  length_label: string
  width_label: string
  thickness_label: string
  volume_label: string
  fin_box_type: FinBoxType
  image_url: string | null
}

type VariantEditDraft = {
  id: string
  length_label: string
  width_label: string
  thickness_label: string
  volume_label: string
  fin_box_type: FinBoxType
}

export function BrandModelVariantsEditor({
  brandId,
  brandModelId,
  modelName,
  disabled,
  onReload,
}: {
  brandId: string
  brandModelId: string
  modelName: string
  disabled?: boolean
  onReload: () => Promise<void>
}) {
  const [loading, setLoading] = React.useState(true)
  const [rows, setRows] = React.useState<VariantRow[]>([])
  const [saving, setSaving] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [imagePatchingId, setImagePatchingId] = React.useState<string | null>(null)
  const [lengthLabel, setLengthLabel] = React.useState("")
  const [widthLabel, setWidthLabel] = React.useState("")
  const [thicknessLabel, setThicknessLabel] = React.useState("")
  const [volumeLabel, setVolumeLabel] = React.useState("")
  const [finBoxType, setFinBoxType] = React.useState<FinBoxType>("futures")
  /** Reused for new row when duplicating (file upload overrides on submit). */
  const [stagedImageUrl, setStagedImageUrl] = React.useState<string | null>(null)
  const [duplicateDraft, setDuplicateDraft] = React.useState(false)
  const [editDraft, setEditDraft] = React.useState<VariantEditDraft | null>(null)
  const [savingEditId, setSavingEditId] = React.useState<string | null>(null)
  const dimImageInputRef = React.useRef<HTMLInputElement>(null)
  const addFormRef = React.useRef<HTMLDivElement>(null)

  const addFormDisabled = disabled || saving || loading || !!editDraft

  const loadVariants = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/admin/brand-model-variants?brand_model_id=${encodeURIComponent(brandModelId)}`,
        { credentials: "include" },
      )
      const json = (await res.json().catch(() => ({}))) as {
        data?: { rows?: VariantRow[] }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not load variants")
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

  async function uploadDimensionImage(file: File): Promise<string | null> {
    if (file.size > DIM_IMAGE_MAX) {
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

  function clearAddForm() {
    setLengthLabel("")
    setWidthLabel("")
    setThicknessLabel("")
    setVolumeLabel("")
    setFinBoxType("futures")
    setStagedImageUrl(null)
    setDuplicateDraft(false)
    if (dimImageInputRef.current) dimImageInputRef.current.value = ""
  }

  function cancelEditing() {
    setEditDraft(null)
  }

  function startEditing(row: VariantRow) {
    setEditDraft({
      id: row.id,
      length_label: row.length_label,
      width_label: row.width_label,
      thickness_label: row.thickness_label,
      volume_label: row.volume_label,
      fin_box_type: row.fin_box_type,
    })
  }

  async function saveEditing() {
    if (!editDraft) return
    const L = editDraft.length_label.trim()
    const W = editDraft.width_label.trim()
    const T = editDraft.thickness_label.trim()
    const V = editDraft.volume_label.trim()
    if (!L || !W || !T || !V) {
      toast.error("Length, width, thickness, and volume are required")
      return
    }

    setSavingEditId(editDraft.id)
    try {
      const res = await fetch(`/api/admin/brand-model-variants/${encodeURIComponent(editDraft.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          length_label: L,
          width_label: W,
          thickness_label: T,
          volume_label: V,
          fin_box_type: editDraft.fin_box_type,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not update variant")
        return
      }
      toast.success("Variant updated")
      cancelEditing()
      await loadVariants()
      await onReload()
    } finally {
      setSavingEditId(null)
    }
  }

  function duplicateVariantIntoForm(row: VariantRow) {
    cancelEditing()
    setLengthLabel(row.length_label)
    setWidthLabel(row.width_label)
    setThicknessLabel(row.thickness_label)
    setVolumeLabel(row.volume_label)
    setFinBoxType(row.fin_box_type)
    setStagedImageUrl(row.image_url)
    setDuplicateDraft(true)
    if (dimImageInputRef.current) dimImageInputRef.current.value = ""
    toast.message("Copied to form", {
      description: "Adjust fin, dimensions, or photo, then click Add variant.",
    })
    window.requestAnimationFrame(() => {
      addFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
  }

  async function handleAddVariant(e: React.FormEvent) {
    e.preventDefault()
    const L = lengthLabel.trim()
    const W = widthLabel.trim()
    const T = thicknessLabel.trim()
    const V = volumeLabel.trim()
    if (!L || !W || !T || !V) {
      toast.error("Length, width, thickness, and volume are required")
      return
    }

    const file = dimImageInputRef.current?.files?.[0]
    let imageUrl: string | null = null
    if (file) {
      const uploaded = await uploadDimensionImage(file)
      if (!uploaded) return
      imageUrl = uploaded
    } else if (stagedImageUrl) {
      imageUrl = stagedImageUrl
    }

    setSaving(true)
    try {
      const res = await fetch("/api/admin/brand-model-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          brand_id: brandId,
          brand_model_id: brandModelId,
          length_label: L,
          width_label: W,
          thickness_label: T,
          volume_label: V,
          fin_box_type: finBoxType,
          image_url: imageUrl,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not save variant")
        return
      }
      toast.success("Variant added")
      clearAddForm()
      await loadVariants()
      await onReload()
    } finally {
      setSaving(false)
    }
  }

  async function patchVariantImage(variantId: string, imageUrl: string | null) {
    setImagePatchingId(variantId)
    try {
      const res = await fetch(`/api/admin/brand-model-variants/${encodeURIComponent(variantId)}`, {
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
      await loadVariants()
      await onReload()
    } finally {
      setImagePatchingId(null)
    }
  }

  async function handleDimImageFile(variantId: string, file: File | undefined) {
    if (!file) return
    const url = await uploadDimensionImage(file)
    if (!url) return
    await patchVariantImage(variantId, url)
  }

  async function handleDeleteVariant(variantId: string) {
    setDeletingId(variantId)
    try {
      const res = await fetch(`/api/admin/brand-model-variants/${encodeURIComponent(variantId)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not remove variant")
        return
      }
      toast.success("Variant removed")
      await loadVariants()
      await onReload()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="rounded-xl border border-border/50 bg-background/90 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Variants · {modelName}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Each row is one size plus a fin system (never combined). Duplicate dims are OK if fin type differs.
          </p>
        </div>
        {!loading ? (
          <span className="mt-1 inline-flex w-fit rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground sm:mt-0">
            {rows.length} saved
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading variants…
        </div>
      ) : null}

      <Separator className="my-4 bg-border/60" />

      <div ref={addFormRef}>
        <form onSubmit={handleAddVariant} className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Add variant</p>
            {duplicateDraft ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 text-xs text-muted-foreground"
                disabled={addFormDisabled}
                onClick={clearAddForm}
              >
                Clear form
              </Button>
            ) : null}
          </div>
          {editDraft ? (
            <p className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              Finish or cancel editing a saved variant below before adding a new one here.
            </p>
          ) : null}
          {duplicateDraft ? (
            <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-relaxed text-foreground">
                <span className="font-medium">Duplicate draft.</span> Change fin system or dimensions if this would
                collide with an existing row, then save.
              </p>
              {stagedImageUrl ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="relative h-10 w-10 overflow-hidden rounded-md bg-muted ring-1 ring-border/40">
                    <Image src={stagedImageUrl} alt="" fill className="object-cover" sizes="40px" />
                  </span>
                  <span className="text-[11px] text-muted-foreground">Photo copied · upload to replace</span>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor={`var-l-${brandModelId}`} className="text-xs">
              Length
            </Label>
            <Input
              id={`var-l-${brandModelId}`}
              value={lengthLabel}
              onChange={(e) => setLengthLabel(e.target.value)}
              placeholder="5'6"
              autoComplete="off"
              disabled={addFormDisabled}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`var-w-${brandModelId}`} className="text-xs">
              Width
            </Label>
            <Input
              id={`var-w-${brandModelId}`}
              value={widthLabel}
              onChange={(e) => setWidthLabel(e.target.value)}
              placeholder="19 1/4"
              autoComplete="off"
              disabled={addFormDisabled}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`var-t-${brandModelId}`} className="text-xs">
              Thickness
            </Label>
            <Input
              id={`var-t-${brandModelId}`}
              value={thicknessLabel}
              onChange={(e) => setThicknessLabel(e.target.value)}
              placeholder="2 3/8"
              autoComplete="off"
              disabled={addFormDisabled}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`var-v-${brandModelId}`} className="text-xs">
              Volume
            </Label>
            <Input
              id={`var-v-${brandModelId}`}
              value={volumeLabel}
              onChange={(e) => setVolumeLabel(e.target.value)}
              placeholder="29.5 L"
              autoComplete="off"
              disabled={addFormDisabled}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`var-fin-${brandModelId}`} className="text-xs">
              Fin system
            </Label>
            <Select
              value={finBoxType}
              onValueChange={(v) => setFinBoxType(v as FinBoxType)}
              disabled={addFormDisabled}
            >
              <SelectTrigger id={`var-fin-${brandModelId}`} className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="futures">Futures</SelectItem>
                <SelectItem value="fcs">FCS</SelectItem>
                <SelectItem value="single_fin">Single fin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
            <Label htmlFor={`var-img-${brandModelId}`} className="text-xs">
              Photo (optional)
            </Label>
            <Input
              id={`var-img-${brandModelId}`}
              ref={dimImageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={addFormDisabled}
              className="h-9 cursor-pointer text-sm file:mr-2 file:text-xs"
              onChange={() => {
                const f = dimImageInputRef.current?.files?.[0]
                if (f) setStagedImageUrl(null)
              }}
            />
          </div>
        </div>
        <Button type="submit" size="sm" className="gap-1.5" disabled={addFormDisabled}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add variant
        </Button>
        </form>
      </div>

      <div className="mt-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Saved variants</p>
        {!loading && rows.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
            No variants yet. Add dimensions and a fin system above.
          </p>
        ) : null}
        {!loading && rows.length > 0 ? (
          <ul className="mt-3 max-h-[min(28rem,calc(100dvh-20rem))] space-y-2 overflow-y-auto pr-0.5 md:max-h-[calc(100dvh-18rem)]">
            {rows.map((d) => {
              const isEditing = editDraft?.id === d.id
              const rowBusy =
                disabled ||
                deletingId === d.id ||
                imagePatchingId === d.id ||
                saving ||
                savingEditId === d.id

              return (
                <li
                  key={d.id}
                  className={cn(
                    "rounded-lg border border-border/50 bg-card px-3 py-3 text-xs shadow-sm",
                    isEditing && "ring-2 ring-primary/25",
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/30">
                        {d.image_url ? (
                          <Image src={d.image_url} alt="" fill className="object-cover" sizes="56px" />
                        ) : (
                          <div className="flex h-full items-center justify-center px-0.5 text-center text-[10px] text-muted-foreground">
                            No photo
                          </div>
                        )}
                        {d.image_url ? (
                          <button
                            type="button"
                            className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded bg-background/95 text-muted-foreground hover:text-destructive"
                            aria-label="Remove variant image"
                            disabled={rowBusy || (!!editDraft && editDraft.id !== d.id)}
                            onClick={() => patchVariantImage(d.id, null)}
                          >
                            {imagePatchingId === d.id ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <X className="h-2.5 w-2.5" />
                            )}
                          </button>
                        ) : null}
                      </div>

                      {isEditing && editDraft ? (
                        <div className="min-w-0 flex-1 space-y-3">
                          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            Edit variant
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="space-y-1">
                              <Label htmlFor={`edit-l-${d.id}`} className="text-[11px]">
                                Length
                              </Label>
                              <Input
                                id={`edit-l-${d.id}`}
                                value={editDraft.length_label}
                                onChange={(e) =>
                                  setEditDraft((prev) =>
                                    prev && prev.id === d.id ? { ...prev, length_label: e.target.value } : prev,
                                  )
                                }
                                className="h-8 text-sm"
                                disabled={savingEditId === d.id}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`edit-w-${d.id}`} className="text-[11px]">
                                Width
                              </Label>
                              <Input
                                id={`edit-w-${d.id}`}
                                value={editDraft.width_label}
                                onChange={(e) =>
                                  setEditDraft((prev) =>
                                    prev && prev.id === d.id ? { ...prev, width_label: e.target.value } : prev,
                                  )
                                }
                                className="h-8 text-sm"
                                disabled={savingEditId === d.id}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`edit-t-${d.id}`} className="text-[11px]">
                                Thickness
                              </Label>
                              <Input
                                id={`edit-t-${d.id}`}
                                value={editDraft.thickness_label}
                                onChange={(e) =>
                                  setEditDraft((prev) =>
                                    prev && prev.id === d.id ? { ...prev, thickness_label: e.target.value } : prev,
                                  )
                                }
                                className="h-8 text-sm"
                                disabled={savingEditId === d.id}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`edit-v-${d.id}`} className="text-[11px]">
                                Volume
                              </Label>
                              <Input
                                id={`edit-v-${d.id}`}
                                value={editDraft.volume_label}
                                onChange={(e) =>
                                  setEditDraft((prev) =>
                                    prev && prev.id === d.id ? { ...prev, volume_label: e.target.value } : prev,
                                  )
                                }
                                className="h-8 text-sm"
                                disabled={savingEditId === d.id}
                              />
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <Label htmlFor={`edit-fin-${d.id}`} className="text-[11px]">
                                Fin system
                              </Label>
                              <Select
                                value={editDraft.fin_box_type}
                                onValueChange={(v) =>
                                  setEditDraft((prev) =>
                                    prev && prev.id === d.id ? { ...prev, fin_box_type: v as FinBoxType } : prev,
                                  )
                                }
                                disabled={savingEditId === d.id}
                              >
                                <SelectTrigger id={`edit-fin-${d.id}`} className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="futures">Futures</SelectItem>
                                  <SelectItem value="fcs">FCS</SelectItem>
                                  <SelectItem value="single_fin">Single fin</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 gap-1.5"
                              disabled={savingEditId === d.id}
                              onClick={() => void saveEditing()}
                            >
                              {savingEditId === d.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              {savingEditId === d.id ? "Saving…" : "Save changes"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              disabled={savingEditId === d.id}
                              onClick={cancelEditing}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="text-sm font-medium leading-snug text-foreground">
                            {formatBrandModelVariantLabel(d)}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <input
                              id={`var-row-img-${d.id}`}
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              className="sr-only"
                              disabled={rowBusy || !!editDraft}
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                e.target.value = ""
                                void handleDimImageFile(d.id, f)
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 px-2.5 text-[11px]"
                              disabled={rowBusy || !!editDraft}
                              onClick={() => startEditing(d)}
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 px-2.5 text-[11px]"
                              disabled={rowBusy || !!editDraft}
                              onClick={() => duplicateVariantIntoForm(d)}
                            >
                              <Copy className="h-3 w-3" />
                              Duplicate
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 px-2.5 text-[11px]"
                              disabled={rowBusy || !!editDraft}
                              onClick={() => document.getElementById(`var-row-img-${d.id}`)?.click()}
                            >
                              {imagePatchingId === d.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <ImagePlus className="h-3 w-3" />
                              )}
                              {d.image_url ? "Replace photo" : "Add photo"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    {!isEditing ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 self-start text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:self-center"
                        aria-label={`Delete variant ${formatBrandModelVariantLabel(d)}`}
                        disabled={rowBusy || !!editDraft}
                        onClick={() => handleDeleteVariant(d.id)}
                      >
                        {deletingId === d.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
