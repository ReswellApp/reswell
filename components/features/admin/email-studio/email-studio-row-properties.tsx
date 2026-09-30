"use client"

import { useState } from "react"
import { uploadBlogMediaFile } from "@/lib/blog/upload-blog-media"
import { emailImageSrc } from "@/lib/email-studio/email-image-url"
import type { EmailSectionBlock } from "@/lib/types/emailStudio"
import {
  ColorField,
  PropertyRow,
  PropertySection,
  PurpleSwitch,
  Segmented,
  Stepper,
} from "@/components/features/admin/email-studio/email-studio-property-controls"
import {
  KLAVIYO_EMAIL_BORDER,
  KLAVIYO_EMAIL_COLORS,
} from "@/lib/klaviyo/email-brand-styles"

const SURFACE_COLOR: Record<EmailSectionBlock["surface"], string> = {
  white: KLAVIYO_EMAIL_COLORS.background,
  muted: KLAVIYO_EMAIL_COLORS.canvas,
  brand: KLAVIYO_EMAIL_COLORS.buttonBg,
  dark: KLAVIYO_EMAIL_COLORS.foreground,
}

export function EmailStudioRowProperties({
  section,
  onChange,
}: {
  section: EmailSectionBlock
  onChange: (section: EmailSectionBlock) => void
}) {
  const [uploading, setUploading] = useState(false)
  const imageOn = section.backgroundImage !== undefined

  async function upload(file: File) {
    setUploading(true)
    const uploaded = await uploadBlogMediaFile(file)
    setUploading(false)
    if (uploaded?.url) {
      onChange({ ...section, backgroundImage: emailImageSrc(uploaded.url) })
    }
  }

  return (
    <>
      <PropertySection title="Backgrounds">
        <PropertyRow label="Row background color">
          <ColorField
            label="Row background color"
            value={section.backgroundColor}
            fallback={SURFACE_COLOR[section.surface]}
            onChange={(backgroundColor) => onChange({ ...section, backgroundColor })}
          />
        </PropertyRow>
        <PropertyRow label="Content area background color">
          <ColorField
            label="Content area background color"
            value={section.contentBackgroundColor}
            fallback="#ffffff"
            onChange={(contentBackgroundColor) => onChange({ ...section, contentBackgroundColor })}
          />
        </PropertyRow>
        <PropertyRow label="Row background image">
          <PurpleSwitch
            label="Row background image"
            checked={imageOn}
            onChange={(checked) => {
              if (!checked) {
                onChange({
                  ...section,
                  backgroundImage: undefined,
                  backgroundImageOn: undefined,
                  backgroundFit: undefined,
                  backgroundRepeat: undefined,
                  backgroundCenter: undefined,
                })
                return
              }
              onChange({ ...section, backgroundImage: section.backgroundImage ?? "" })
            }}
          />
        </PropertyRow>
        {imageOn ? (
          <div className="space-y-3 py-2.5">
            <div className="flex items-center gap-2">
              <label className="inline-flex h-8 cursor-pointer items-center rounded-md bg-[#7C5CFC] px-3 text-xs font-medium text-white hover:bg-[#6b4cf0]">
                {uploading ? "Uploading…" : "Replace"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void upload(file)
                  }}
                />
              </label>
            </div>
            <div className="flex h-9 overflow-hidden rounded-md border border-[#e4e4e7]">
              <span className="flex items-center border-r border-[#e4e4e7] bg-[#fafafa] px-2 text-xs text-[#71717a]">Url</span>
              <input
                aria-label="Background image url"
                value={section.backgroundImage ?? ""}
                className="min-w-0 flex-1 bg-white px-2 text-sm outline-none"
                onChange={(event) => onChange({ ...section, backgroundImage: event.target.value })}
                onBlur={(event) => onChange({ ...section, backgroundImage: emailImageSrc(event.target.value) })}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-[#3f3f46]">Apply image to</span>
              <Segmented
                label="Apply image to"
                value={section.backgroundImageOn ?? "row"}
                onChange={(backgroundImageOn) => onChange({ ...section, backgroundImageOn })}
                options={[
                  { value: "content", label: "Content area" },
                  { value: "row", label: "Row" },
                ]}
              />
            </div>
            <PropertyRow label="Fit to background">
              <PurpleSwitch
                label="Fit to background"
                checked={section.backgroundFit !== false}
                onChange={(backgroundFit) => onChange({ ...section, backgroundFit })}
              />
            </PropertyRow>
            <label className="flex items-center gap-2 text-sm text-[#3f3f46]">
              <input
                type="checkbox"
                checked={Boolean(section.backgroundRepeat)}
                onChange={(event) => onChange({ ...section, backgroundRepeat: event.target.checked })}
              />
              Repeat
            </label>
            <label className="flex items-center gap-2 text-sm text-[#3f3f46]">
              <input
                type="checkbox"
                checked={section.backgroundCenter !== false}
                onChange={(event) => onChange({ ...section, backgroundCenter: event.target.checked })}
              />
              Center
            </label>
          </div>
        ) : null}
      </PropertySection>
      <PropertySection title="Borders">
        <PropertyRow label="Border width">
          <Stepper
            label="Border width"
            min={0}
            max={12}
            value={section.borderWidth ?? 0}
            onChange={(borderWidth) => onChange({ ...section, borderWidth: borderWidth === 0 ? undefined : borderWidth })}
          />
        </PropertyRow>
        <PropertyRow label="Border color">
          <ColorField
            label="Border color"
            value={section.borderColor}
            fallback={KLAVIYO_EMAIL_BORDER}
            onChange={(borderColor) => onChange({ ...section, borderColor })}
          />
        </PropertyRow>
      </PropertySection>
    </>
  )
}
