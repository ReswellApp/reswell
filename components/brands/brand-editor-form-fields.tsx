"use client"

import * as React from "react"
import { Globe, ImageIcon, Layers, MapPin, Tag, Users } from "lucide-react"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export type BrandEditorFormFieldsProps = {
  idPrefix: string
  slug: string
  onSlugChange: (next: string) => void
  name: string
  onNameChange: (next: string) => void
  onNameBlur?: () => void
  shortDescription: string
  onShortDescriptionChange: (next: string) => void
  websiteUrl: string
  onWebsiteUrlChange: (next: string) => void
  logoUrl: string
  onLogoUrlChange: (next: string) => void
  logoFileInputRef: React.RefObject<HTMLInputElement | null>
  founderName: string
  onFounderNameChange: (next: string) => void
  leadShaperName: string
  onLeadShaperNameChange: (next: string) => void
  locationLabel: string
  onLocationLabelChange: (next: string) => void
  modelCount: string
  onModelCountChange: (next: string) => void
  /** Extra hint under slug (e.g. attach flow auto-fill note). */
  slugExtraHint?: React.ReactNode
}

function FieldSection({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          {icon}
        </span>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export function BrandEditorFormFields({
  idPrefix,
  slug,
  onSlugChange,
  name,
  onNameChange,
  onNameBlur,
  shortDescription,
  onShortDescriptionChange,
  websiteUrl,
  onWebsiteUrlChange,
  logoUrl,
  onLogoUrlChange,
  logoFileInputRef,
  founderName,
  onFounderNameChange,
  leadShaperName,
  onLeadShaperNameChange,
  locationLabel,
  onLocationLabelChange,
  modelCount,
  onModelCountChange,
  slugExtraHint,
}: BrandEditorFormFieldsProps) {
  return (
    <div className="space-y-4">
      <FieldSection title="Identity" icon={<Tag className="h-4 w-4" />}>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-name`}>Name</Label>
          <Input
            id={`${idPrefix}-name`}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={onNameBlur}
            placeholder="Bing Surfboards"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-slug`}>Slug</Label>
          <Input
            id={`${idPrefix}-slug`}
            value={slug}
            onChange={(e) => onSlugChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="bing-surfboards"
            required
            autoComplete="off"
          />
          <p className="font-mono text-xs text-muted-foreground">{`${BRANDS_BASE}/${slug || "…"}`}</p>
          {slugExtraHint ? <div className="text-[11px] text-muted-foreground">{slugExtraHint}</div> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-short`}>Short description</Label>
          <Textarea
            id={`${idPrefix}-short`}
            value={shortDescription}
            onChange={(e) => onShortDescriptionChange(e.target.value)}
            rows={2}
            placeholder="One-line summary"
          />
          <p className="text-xs text-muted-foreground">
            The only story blurb on the public brand page (below the logo). Long multi-paragraph bios are not used.
          </p>
        </div>
      </FieldSection>

      <FieldSection title="Branding & links" icon={<ImageIcon className="h-4 w-4" />}>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-web`}>
            <span className="inline-flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-slate-400" />
              Website URL
            </span>
          </Label>
          <Input
            id={`${idPrefix}-web`}
            type="url"
            value={websiteUrl}
            onChange={(e) => onWebsiteUrlChange(e.target.value)}
            placeholder="https://"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-logo-url`}>Logo URL (optional if you upload a file)</Label>
          <Input
            id={`${idPrefix}-logo-url`}
            type="url"
            value={logoUrl}
            onChange={(e) => onLogoUrlChange(e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-logo-file`}>Upload logo</Label>
          <Input
            id={`${idPrefix}-logo-file`}
            ref={logoFileInputRef}
            type="file"
            accept="image/*"
            className="cursor-pointer"
          />
          <p className="text-xs text-muted-foreground">PNG, JPG, WebP, GIF, or SVG — max 5MB. Overrides URL if set.</p>
        </div>
      </FieldSection>

      <FieldSection title="People & place" icon={<Users className="h-4 w-4" />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-founder`}>Founder</Label>
            <Input
              id={`${idPrefix}-founder`}
              value={founderName}
              onChange={(e) => onFounderNameChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-lead`}>Lead shaper / designer</Label>
            <Input
              id={`${idPrefix}-lead`}
              value={leadShaperName}
              onChange={(e) => onLeadShaperNameChange(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-loc`}>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              Location
            </span>
          </Label>
          <Input
            id={`${idPrefix}-loc`}
            value={locationLabel}
            onChange={(e) => onLocationLabelChange(e.target.value)}
            placeholder="Encinitas, California"
          />
        </div>
      </FieldSection>

      <FieldSection title="Catalog" icon={<Layers className="h-4 w-4" />}>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-models`}>Model count</Label>
          <Input
            id={`${idPrefix}-models`}
            inputMode="numeric"
            value={modelCount}
            onChange={(e) => onModelCountChange(e.target.value.replace(/\D/g, ""))}
          />
          <p className="text-xs text-muted-foreground">
            Display badge on the public brand page. Add the actual models below or from the catalog explorer.
          </p>
        </div>
      </FieldSection>
    </div>
  )
}
