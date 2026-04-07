"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { slugifyBrandName } from "@/lib/brands/slug"
import type { BrandRow } from "@/lib/brands/types"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const LOGO_MAX = 5 * 1024 * 1024

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

  async function uploadLogoFile(file: File): Promise<string | null> {
    if (file.size > LOGO_MAX) {
      toast.error("Image must be under 5MB")
      return null
    }
    const supabase = createClient()
    const ext = (file.name.split(".").pop() || "png").toLowerCase()
    const safeExt = ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext) ? ext : "png"
    const path = `logos/${crypto.randomUUID()}.${safeExt}`
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const file = fileInputRef.current?.files?.[0]
      let finalLogoUrl = logoUrl.trim() || null
      if (file) {
        const uploaded = await uploadLogoFile(file)
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
        toast.success("Brand created")
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
      toast.success("Brand updated")
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
          <div className="space-y-2">
            <Label htmlFor="brand-slug">Slug</Label>
            <Input
              id="brand-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="bing-surfboards"
              required
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">{`${BRANDS_BASE}/${slug || "…"}`}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-name">Name</Label>
            <Input
              id="brand-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={onNameBlur}
              placeholder="Bing Surfboards"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-short">Short description</Label>
            <Textarea
              id="brand-short"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              rows={2}
              placeholder="One-line summary"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-web">Website URL</Label>
            <Input
              id="brand-web"
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-logo-url">Logo URL (optional if you upload a file)</Label>
            <Input
              id="brand-logo-url"
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-logo-file">Upload logo</Label>
            <Input id="brand-logo-file" ref={fileInputRef} type="file" accept="image/*" className="cursor-pointer" />
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP, GIF, or SVG — max 5MB. Overrides URL if set.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brand-founder">Founder</Label>
              <Input id="brand-founder" value={founderName} onChange={(e) => setFounderName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-lead">Lead shaper / designer</Label>
              <Input id="brand-lead" value={leadShaperName} onChange={(e) => setLeadShaperName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-loc">Location</Label>
            <Input
              id="brand-loc"
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              placeholder="Encinitas, California"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-models">Model count</Label>
            <Input
              id="brand-models"
              inputMode="numeric"
              value={modelCount}
              onChange={(e) => setModelCount(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-about">About (paragraphs separated by a blank line)</Label>
            <Textarea
              id="brand-about"
              value={aboutText}
              onChange={(e) => setAboutText(e.target.value)}
              rows={8}
              className="min-h-[160px] font-mono text-sm"
              placeholder={"First paragraph…\n\nSecond paragraph…"}
            />
          </div>
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
