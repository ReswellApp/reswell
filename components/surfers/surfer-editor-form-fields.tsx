"use client"

import * as React from "react"
import { Loader2, RotateCw, X } from "lucide-react"
import { SURFERS_BASE } from "@/lib/surfers/routes"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { SurferQuiverItem } from "@/lib/surfers/types"
import { surferImagePreviewRotateClass } from "@/lib/surfers/surfer-image-quarter-turns"
import { SurferQuiverEditorSection } from "@/components/surfers/surfer-quiver-editor-section"

export type SurferEditorFormFieldsProps = {
  idPrefix: string
  slug: string
  onSlugChange: (next: string) => void
  name: string
  onNameChange: (next: string) => void
  onNameBlur?: () => void
  shortDescription: string
  onShortDescriptionChange: (next: string) => void
  instagramUrl: string
  onInstagramUrlChange: (next: string) => void
  youtubeUrl: string
  onYoutubeUrlChange: (next: string) => void
  photoUrl: string
  onPhotoUrlChange: (next: string) => void
  /** Bump to reset the native file input value. */
  photoInputKey: number
  photoPreviewUrl: string | null
  photoPreviewLoading: boolean
  photoQuarterTurns: number
  onPhotoFileChange: (file: File | null) => void
  onPhotoRotateQuarterTurn: () => void
  onClearPhotoPick: () => void
  quiverStagingResetKey: number
  locationLabel: string
  onLocationLabelChange: (next: string) => void
  aboutText: string
  onAboutTextChange: (next: string) => void
  quiverItems: SurferQuiverItem[]
  onQuiverItemsChange: React.Dispatch<React.SetStateAction<SurferQuiverItem[]>>
}

export function SurferEditorFormFields({
  idPrefix,
  slug,
  onSlugChange,
  name,
  onNameChange,
  onNameBlur,
  shortDescription,
  onShortDescriptionChange,
  instagramUrl,
  onInstagramUrlChange,
  youtubeUrl,
  onYoutubeUrlChange,
  photoUrl,
  onPhotoUrlChange,
  photoInputKey,
  photoPreviewUrl,
  photoPreviewLoading,
  photoQuarterTurns,
  onPhotoFileChange,
  onPhotoRotateQuarterTurn,
  onClearPhotoPick,
  quiverStagingResetKey,
  locationLabel,
  onLocationLabelChange,
  aboutText,
  onAboutTextChange,
  quiverItems,
  onQuiverItemsChange,
}: SurferEditorFormFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-slug`}>Slug</Label>
        <Input
          id={`${idPrefix}-slug`}
          value={slug}
          onChange={(e) => onSlugChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          placeholder="mary-surf"
          required
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">{`${SURFERS_BASE}/${slug || "…"}`}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onBlur={onNameBlur}
          placeholder="Display name"
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
          placeholder="One-line intro on the profile header"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-bio`}>Bio</Label>
        <Textarea
          id={`${idPrefix}-bio`}
          value={aboutText}
          onChange={(e) => onAboutTextChange(e.target.value)}
          rows={8}
          placeholder="Long-form bio. Separate paragraphs with a blank line."
        />
        <p className="text-xs text-muted-foreground">
          Shown as separate paragraphs below the header on the public page.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-ig`}>Instagram URL</Label>
        <Input
          id={`${idPrefix}-ig`}
          type="url"
          inputMode="url"
          value={instagramUrl}
          onChange={(e) => onInstagramUrlChange(e.target.value)}
          placeholder="https://www.instagram.com/…"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-yt`}>YouTube URL</Label>
        <Input
          id={`${idPrefix}-yt`}
          type="url"
          inputMode="url"
          value={youtubeUrl}
          onChange={(e) => onYoutubeUrlChange(e.target.value)}
          placeholder="https://www.youtube.com/…"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-photo-url`}>Photo URL (optional if you upload a file)</Label>
        <Input
          id={`${idPrefix}-photo-url`}
          type="url"
          value={photoUrl}
          onChange={(e) => onPhotoUrlChange(e.target.value)}
          placeholder="https://…"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-photo-file`}>Upload photo</Label>
        <Input
          key={photoInputKey}
          id={`${idPrefix}-photo-file`}
          type="file"
          accept="image/*,.heic,.heif"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            onPhotoFileChange(f)
          }}
        />
        {photoPreviewLoading || photoPreviewUrl ? (
          <div className="relative mt-2 aspect-square w-full max-w-[220px] overflow-hidden rounded-lg border border-border bg-muted">
            {photoPreviewUrl ? (
              <img
                src={photoPreviewUrl}
                alt=""
                className={cn(
                  "absolute inset-0 h-full w-full origin-center object-cover object-center transition-transform duration-200",
                  surferImagePreviewRotateClass(photoQuarterTurns),
                )}
              />
            ) : null}
            {photoPreviewLoading ? (
              <div className="absolute inset-0 z-[4] flex items-center justify-center bg-muted/90">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
                <span className="sr-only">Loading preview</span>
              </div>
            ) : null}
            <button
              type="button"
              onClick={onPhotoRotateQuarterTurn}
              disabled={photoPreviewLoading || !photoPreviewUrl}
              className={cn(
                "absolute left-1 top-1 z-[5] flex h-9 w-9 items-center justify-center rounded-full touch-manipulation sm:h-8 sm:w-8",
                "bg-background/80 shadow-sm ring-1 ring-black/5 hover:bg-background",
                (photoPreviewLoading || !photoPreviewUrl) && "pointer-events-none opacity-40",
              )}
              aria-label="Rotate photo 90 degrees clockwise"
              title="Rotate 90°"
            >
              <RotateCw className="h-3.5 w-3.5 sm:h-3 sm:w-3" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onClearPhotoPick}
              className={cn(
                "absolute right-1 top-1 z-[5] flex h-9 w-9 items-center justify-center rounded-full touch-manipulation sm:h-8 sm:w-8",
                "bg-background/80 shadow-sm ring-1 ring-black/5 hover:bg-background",
              )}
              aria-label="Remove selected photo file"
            >
              <X className="h-3.5 w-3.5 sm:h-3 sm:w-3" aria-hidden />
            </button>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          HEIC and similar formats load a JPEG preview in the browser first (same as /sell). Up to 25MB per file; we convert to WebP before storage (5MB max
          stored). Tap rotate for 90° steps to straighten (e.g. horizontal board → vertical in frame).
        </p>
      </div>
      <SurferQuiverEditorSection
        idPrefix={idPrefix}
        items={quiverItems}
        onItemsChange={onQuiverItemsChange}
        stagingResetKey={quiverStagingResetKey}
      />
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-loc`}>Location</Label>
        <Input
          id={`${idPrefix}-loc`}
          value={locationLabel}
          onChange={(e) => onLocationLabelChange(e.target.value)}
          placeholder="City, region"
        />
      </div>
    </div>
  )
}
