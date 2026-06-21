"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Boxes, Loader2, Pencil, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { slugifyBrandName } from "@/lib/brands/slug"
import type { BrandRow } from "@/lib/brands/types"
import { BRANDS_BASE } from "@/lib/brands/routes"
import type { BrandProductCategorySlug } from "@/lib/brand-product-categories"
import { uploadBrandLogoFile } from "@/lib/brands/upload-brand-logo-client"
import { BrandEditorFormFields } from "@/components/brands/brand-editor-form-fields"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"

type Mode = "create" | "edit"

/** Prefill when opening Add brand from an admin brand request (sell-flow UGC). */
export type BrandCreatePrefillFromRequest = {
  brand_request_id: string
  slug: string
  name: string
  short_description: string
  website_url: string | null
  logo_url: string | null
  founder_name: string | null
  lead_shaper_name: string | null
  location_label: string | null
  model_count: number
}

export function BrandEditorDialog({
  open,
  onOpenChange,
  mode,
  brand,
  createPrefill,
  onSaved,
  redirectOnCreate = true,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: Mode
  brand: BrandRow | null
  /** When set with mode create, form fields load from a pending `brand_requests` row. */
  createPrefill?: BrandCreatePrefillFromRequest | null
  onSaved?: () => void
  /** Public /brands flow navigates to the new brand page; admin tools stay put and refresh. */
  redirectOnCreate?: boolean
}) {
  const router = useRouter()
  const [saving, setSaving] = React.useState(false)
  const [slug, setSlug] = React.useState("")
  const [name, setName] = React.useState("")
  const [shortDescription, setShortDescription] = React.useState("")
  const [websiteUrl, setWebsiteUrl] = React.useState("")
  const [logoUrl, setLogoUrl] = React.useState("")
  const [founderName, setFounderName] = React.useState("")
  const [leadShaperName, setLeadShaperName] = React.useState("")
  const [locationLabel, setLocationLabel] = React.useState("")
  const [modelCount, setModelCount] = React.useState("0")
  const [productCategories, setProductCategories] = React.useState<BrandProductCategorySlug[]>([
    "surfboards",
  ])
  const [sourceBrandRequestId, setSourceBrandRequestId] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) return
    if (mode === "edit" && brand) {
      setSourceBrandRequestId(null)
      setSlug(brand.slug)
      setName(brand.name)
      setShortDescription(brand.short_description ?? "")
      setWebsiteUrl(brand.website_url ?? "")
      setLogoUrl(brand.logo_url ?? "")
      setFounderName(brand.founder_name ?? "")
      setLeadShaperName(brand.lead_shaper_name ?? "")
      setLocationLabel(brand.location_label ?? "")
      setModelCount(String(brand.model_count ?? 0))
      setProductCategories(brand.product_categories.length > 0 ? brand.product_categories : ["surfboards"])
    } else if (mode === "create" && createPrefill) {
      setSourceBrandRequestId(createPrefill.brand_request_id)
      setSlug(createPrefill.slug)
      setName(createPrefill.name)
      setShortDescription(createPrefill.short_description ?? "")
      setWebsiteUrl(createPrefill.website_url ?? "")
      setLogoUrl(createPrefill.logo_url ?? "")
      setFounderName(createPrefill.founder_name ?? "")
      setLeadShaperName(createPrefill.lead_shaper_name ?? "")
      setLocationLabel(createPrefill.location_label ?? "")
      setModelCount(String(Math.max(0, createPrefill.model_count ?? 0)))
      setProductCategories(["surfboards"])
      if (fileInputRef.current) fileInputRef.current.value = ""
    } else if (mode === "create") {
      setSourceBrandRequestId(null)
      setSlug("")
      setName("")
      setShortDescription("")
      setWebsiteUrl("")
      setLogoUrl("")
      setFounderName("")
      setLeadShaperName("")
      setLocationLabel("")
      setModelCount("0")
      setProductCategories(["surfboards"])
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [open, mode, brand, createPrefill])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const file = fileInputRef.current?.files?.[0]
      let finalLogoUrl = logoUrl.trim() || null
      if (file) {
        const uploaded = await uploadBrandLogoFile(file)
        if (!uploaded) {
          setSaving(false)
          return
        }
        finalLogoUrl = uploaded
      }

      const mc = Math.max(0, Math.floor(Number(modelCount) || 0))

      /** Long-form `about_paragraphs` is retired; clear on save so the brand page stays short-description only. */
      const about_paragraphs: string[] = []

      if (mode === "create") {
        const res = await fetch("/api/admin/brands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: slug.trim(),
            name: name.trim(),
            short_description: shortDescription.trim() || null,
            website_url: websiteUrl.trim() || null,
            logo_url: finalLogoUrl,
            founder_name: founderName.trim() || null,
            lead_shaper_name: leadShaperName.trim() || null,
            location_label: locationLabel.trim() || null,
            model_count: mc,
            about_paragraphs,
            product_categories: productCategories,
            ...(sourceBrandRequestId ? { brand_request_id: sourceBrandRequestId } : {}),
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(typeof json.error === "string" ? json.error : "Could not create brand")
          return
        }
        toast.success("Brand created")
        onOpenChange(false)
        onSaved?.()
        if (redirectOnCreate) {
          router.push(`${BRANDS_BASE}/${json.slug}`)
        }
        router.refresh()
        return
      }

      if (!brand) return
      const res = await fetch(`/api/admin/brands/${encodeURIComponent(brand.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug.trim() !== brand.slug ? slug.trim() : undefined,
          name: name.trim(),
          short_description: shortDescription.trim() || null,
          website_url: websiteUrl.trim() || null,
          logo_url: finalLogoUrl,
          founder_name: founderName.trim() || null,
          lead_shaper_name: leadShaperName.trim() || null,
          location_label: locationLabel.trim() || null,
          model_count: mc,
          about_paragraphs,
          product_categories: productCategories,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not save")
        return
      }
      onOpenChange(false)
      onSaved?.()
      if (json.slug && json.slug !== brand.slug) {
        router.push(`${BRANDS_BASE}/${json.slug}`)
      } else {
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  function onNameBlur() {
    if (mode !== "create" || slug.trim().length > 0) return
    if (name.trim()) setSlug(slugifyBrandName(name))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,860px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {/* PRO header */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 px-6 py-5 text-white">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80">
            <Sparkles className="h-3 w-3" />
            Pro · Catalog CMS
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15">
              {mode === "create" ? <Boxes className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold tracking-tight text-white">
                {mode === "create" ? "Add brand" : `Edit ${brand?.name ?? "brand"}`}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-sm text-slate-300">
                {mode === "create" && createPrefill
                  ? "Prefilled from a seller brand request — review, edit, then create."
                  : mode === "create"
                    ? "Create a catalog entry. The slug becomes the public URL path."
                    : "Changes apply immediately on save."}
              </DialogDescription>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-6 py-5">
            <BrandEditorFormFields
              idPrefix="brand-editor"
              slug={slug}
              onSlugChange={setSlug}
              name={name}
              onNameChange={setName}
              onNameBlur={onNameBlur}
              shortDescription={shortDescription}
              onShortDescriptionChange={setShortDescription}
              websiteUrl={websiteUrl}
              onWebsiteUrlChange={setWebsiteUrl}
              logoUrl={logoUrl}
              onLogoUrlChange={setLogoUrl}
              logoFileInputRef={fileInputRef}
              founderName={founderName}
              onFounderNameChange={setFounderName}
              leadShaperName={leadShaperName}
              onLeadShaperNameChange={setLeadShaperName}
              locationLabel={locationLabel}
              onLocationLabelChange={setLocationLabel}
              modelCount={modelCount}
              onModelCountChange={setModelCount}
              productCategories={productCategories}
              onProductCategoriesChange={setProductCategories}
            />
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : mode === "create" ? (
                "Create brand"
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
