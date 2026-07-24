"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { toast } from "sonner"
import { Archive, ExternalLink, ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { listingDetailHref } from "@/lib/listing-href"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import { createClient } from "@/lib/supabase/client"
import { prepareListingImagePairFromFile } from "@/lib/listing-image-pipeline"
import { uploadListingImagePairToSupabase } from "@/lib/listing-image-storage"
import { RESWELL_SHOP_DEFAULT_PACKAGE } from "@/lib/reswell-shop-shipping"
import type { ReswellShopAdminProduct } from "@/lib/services/reswellShopAdmin"
import type { ReswellShopPackageInches } from "@/lib/reswell-shop-shipping"

type FormState = {
  title: string
  description: string
  price: string
  stock_quantity: string
  image_urls: string[]
  lengthIn: string
  widthIn: string
  heightIn: string
  weightLb: string
}

function packageToFormFields(pkg: ReswellShopPackageInches) {
  return {
    lengthIn: String(pkg.lengthIn),
    widthIn: String(pkg.widthIn),
    heightIn: String(pkg.heightIn),
    weightLb: String(pkg.weightLb),
  }
}

const emptyForm = (): FormState => ({
  title: "",
  description: "",
  price: "",
  stock_quantity: "1",
  image_urls: [],
  ...packageToFormFields(RESWELL_SHOP_DEFAULT_PACKAGE),
})

function productToForm(p: ReswellShopAdminProduct): FormState {
  return {
    title: p.title,
    description: p.description ?? "",
    price: String(p.price),
    stock_quantity: String(p.stock_quantity),
    image_urls: [...p.image_urls],
    ...packageToFormFields(p.package),
  }
}

function formToPayload(form: FormState) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    price: Number(form.price),
    stock_quantity: Math.floor(Number(form.stock_quantity) || 0),
    image_urls: form.image_urls,
    package: {
      lengthIn: Number(form.lengthIn),
      widthIn: Number(form.widthIn),
      heightIn: Number(form.heightIn),
      weightLb: Number(form.weightLb),
    },
  }
}

export function AdminShopClient() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [products, setProducts] = useState<ReswellShopAdminProduct[]>([])
  const [form, setForm] = useState<FormState>(() => emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setConfigError(null)
    try {
      const res = await fetch("/api/admin/shop")
      const json = (await res.json()) as {
        data?: {
          products: ReswellShopAdminProduct[]
        }
        error?: string
      }
      if (!res.ok) {
        setConfigError(typeof json.error === "string" ? json.error : "Could not load shop")
        setProducts([])
        return
      }
      setProducts(json.data?.products ?? [])
    } catch {
      setConfigError("Could not load shop")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setShowForm(true)
  }

  function startEdit(p: ReswellShopAdminProduct) {
    setEditingId(p.id)
    setForm(productToForm(p))
    setShowForm(true)
  }

  async function uploadImages(files: FileList | null) {
    if (!files?.length) return
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      toast.error("Sign in again to upload photos")
      return
    }

    const remaining = 12 - form.image_urls.length
    if (remaining <= 0) {
      toast.error("Maximum 12 images")
      return
    }

    const batch = Array.from(files).slice(0, remaining)
    setUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of batch) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image`)
          continue
        }
        const prepared = await prepareListingImagePairFromFile(file)
        const { fullUrl } = await uploadListingImagePairToSupabase({
          supabase,
          userId: user.id,
          clientId: crypto.randomUUID(),
          prepared,
        })
        uploaded.push(fullUrl)
      }
      if (uploaded.length > 0) {
        setForm((f) => ({ ...f, image_urls: [...f.image_urls, ...uploaded] }))
        toast.success(uploaded.length === 1 ? "Photo added" : `${uploaded.length} photos added`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function removeImage(url: string) {
    setForm((f) => ({ ...f, image_urls: f.image_urls.filter((u) => u !== url) }))
  }

  async function save() {
    const payload = formToPayload(form)
    if (!payload.title || !payload.description) {
      toast.error("Title and description are required")
      return
    }
    if (!Number.isFinite(payload.price) || payload.price <= 0) {
      toast.error("Enter a valid price")
      return
    }
    if (payload.image_urls.length === 0) {
      toast.error("Add at least one product photo")
      return
    }
    const pkg = payload.package
    if (
      ![pkg.lengthIn, pkg.widthIn, pkg.heightIn, pkg.weightLb].every((n) => Number.isFinite(n) && n > 0)
    ) {
      toast.error("Enter shipping box length, width, height, and weight")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(editingId ? `/api/admin/shop/${editingId}` : "/api/admin/shop", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as { error?: unknown }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Save failed")
        return
      }
      toast.success(editingId ? "Product updated" : "Product created")
      setShowForm(false)
      setEditingId(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function archive(id: string) {
    if (!window.confirm("Archive this product? It will be hidden from the site.")) return
    const res = await fetch(`/api/admin/shop/${id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Could not archive product")
      return
    }
    toast.success("Archived")
    await load()
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reswell</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            New items sold and shipped by Reswell — shipping only, live ShipEngine rates at checkout.
          </p>
          <Link
            href="/reswell/shop"
            className="mt-2 inline-flex items-center gap-1 text-sm text-foreground underline underline-offset-4"
          >
            View public shop <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
        <Button type="button" onClick={startCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New product
        </Button>
      </div>

      {configError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
          {configError}
        </div>
      ) : null}

      {showForm ? (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-lg font-medium">{editingId ? "Edit product" : "New product"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="shop-title">Title</Label>
              <Input
                id="shop-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="shop-desc">Description</Label>
              <Textarea
                id="shop-desc"
                rows={4}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop-price">Price (USD)</Label>
              <Input
                id="shop-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop-stock">Stock quantity</Label>
              <Input
                id="shop-stock"
                type="number"
                min="0"
                step="1"
                value={form.stock_quantity}
                onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 space-y-3 rounded-lg border border-border/80 bg-muted/30 p-4">
              <div>
                <Label className="text-base">Shipping box</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Unique to this product. Checkout quotes a live ShipEngine rate from these
                  dimensions (shipping only — no pickup).
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="box-l">Length (in)</Label>
                  <Input
                    id="box-l"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={form.lengthIn}
                    onChange={(e) => setForm((f) => ({ ...f, lengthIn: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="box-w">Width (in)</Label>
                  <Input
                    id="box-w"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={form.widthIn}
                    onChange={(e) => setForm((f) => ({ ...f, widthIn: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="box-h">Height (in)</Label>
                  <Input
                    id="box-h"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={form.heightIn}
                    onChange={(e) => setForm((f) => ({ ...f, heightIn: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="box-wt">Weight (lb)</Label>
                  <Input
                    id="box-wt"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={form.weightLb}
                    onChange={(e) => setForm((f) => ({ ...f, weightLb: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="sm:col-span-2 space-y-3">
              <Label>Photos</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void uploadImages(e.target.files)}
              />
              <div className="flex flex-wrap gap-3">
                {form.image_urls.map((url) => {
                  const src = proxiedListingImageSrc(url) || url
                  return (
                    <div
                      key={url}
                      className="relative h-24 w-24 overflow-hidden rounded-lg border border-border bg-muted"
                    >
                      <Image src={src} alt="" fill className="object-cover" sizes="96px" />
                      <button
                        type="button"
                        onClick={() => removeImage(url)}
                        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                        aria-label="Remove photo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
                <button
                  type="button"
                  disabled={uploading || form.image_urls.length >= 12}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-5 w-5" />
                  )}
                  <span className="text-[11px]">Add</span>
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void save()} disabled={saving || uploading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingId ? "Save changes" : "Create product"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading products…
        </div>
      ) : products.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products yet. Create one to stock the shop.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {products.map((p) => {
            const thumb = p.image_urls[0] ? proxiedListingImageSrc(p.image_urls[0]) : null
            return (
              <li key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {thumb ? (
                    <Image src={thumb} alt="" fill className="object-cover" sizes="64px" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Trash2 className="h-4 w-4 opacity-40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{p.title}</p>
                  <p className="text-sm text-muted-foreground">
                    ${p.price.toFixed(2)} · qty {p.stock_quantity} · box{" "}
                    {p.package.lengthIn}×{p.package.widthIn}×{p.package.heightIn} in ·{" "}
                    {p.package.weightLb} lb
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" asChild>
                    <Link href={listingDetailHref({ id: p.id, slug: p.slug, section: "new" })}>
                      View
                    </Link>
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => startEdit(p)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void archive(p.id)}>
                    <Archive className="mr-1 h-3.5 w-3.5" />
                    Archive
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
