"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { slugifyBrandName } from "@/lib/brands/slug"
import type { BrandRow } from "@/lib/brands/types"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { uploadBrandLogoFile } from "@/lib/brands/upload-brand-logo-client"
import { BrandEditorFormFields } from "@/components/brands/brand-editor-form-fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  about_paragraphs: string[]
  model_count: number
}

export function BrandEditorDialog({
  open,
  onOpenChange,
  mode,
  brand,
  createPrefill,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: Mode
  brand: BrandRow | null
  /** When set with mode create, form fields load from a pending `brand_requests` row. */
  createPrefill?: BrandCreatePrefillFromRequest | null
  onSaved?: () => void
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
  const [aboutText, setAboutText] = React.useState("")
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
      setAboutText((brand.about_paragraphs ?? []).join("\n\n"))
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
      setAboutText((createPrefill.about_paragraphs ?? []).join("\n\n"))
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
      setAboutText("")
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

      const about_paragraphs = aboutText
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)

      const mc = Math.max(0, Math.floor(Number(modelCount) || 0))

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
            ...(sourceBrandRequestId ? { brand_request_id: sourceBrandRequestId } : {}),
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(typeof json.error === "string" ? json.error : "Could not create brand")
          return
        }
        onOpenChange(false)
        onSaved?.()
        router.push(`${BRANDS_BASE}/${json.slug}`)
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
      <DialogContent className="max-h-[min(90vh,800px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add brand" : "Edit brand"}</DialogTitle>
          <DialogDescription>
            {mode === "create" && createPrefill
              ? "Prefilled from a seller brand request. Review, edit anything, then create to add the directory page and mark the request approved."
              : mode === "create"
                ? "Create a catalog entry. Slug becomes the URL path."
                : "Changes apply immediately on save."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            aboutText={aboutText}
            onAboutTextChange={setAboutText}
          />
          <DialogFooter className="gap-2 sm:gap-0">
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
                "Create"
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
