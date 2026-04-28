"use client"

import * as React from "react"
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
  aboutText: string
  onAboutTextChange: (next: string) => void
  /** Extra hint under slug (e.g. attach flow auto-fill note). */
  slugExtraHint?: React.ReactNode
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
  aboutText,
  onAboutTextChange,
  slugExtraHint,
}: BrandEditorFormFieldsProps) {
  return (
    <div className="space-y-4">
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
        <p className="text-xs text-muted-foreground">{`${BRANDS_BASE}/${slug || "…"}`}</p>
        {slugExtraHint ? <div className="text-muted-foreground text-[11px]">{slugExtraHint}</div> : null}
      </div>
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
        <Label htmlFor={`${idPrefix}-short`}>Short description</Label>
        <Textarea
          id={`${idPrefix}-short`}
          value={shortDescription}
          onChange={(e) => onShortDescriptionChange(e.target.value)}
          rows={2}
          placeholder="One-line summary"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-web`}>Website URL</Label>
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
        <Label htmlFor={`${idPrefix}-loc`}>Location</Label>
        <Input
          id={`${idPrefix}-loc`}
          value={locationLabel}
          onChange={(e) => onLocationLabelChange(e.target.value)}
          placeholder="Encinitas, California"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-models`}>Model count</Label>
        <Input
          id={`${idPrefix}-models`}
          inputMode="numeric"
          value={modelCount}
          onChange={(e) => onModelCountChange(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-about`}>About (paragraphs separated by a blank line)</Label>
        <Textarea
          id={`${idPrefix}-about`}
          value={aboutText}
          onChange={(e) => onAboutTextChange(e.target.value)}
          rows={8}
          className="min-h-[160px] font-mono text-sm"
          placeholder={"First paragraph…\n\nSecond paragraph…"}
        />
      </div>
    </div>
  )
}
