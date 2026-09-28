"use client"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AdsFileField } from "@/components/features/admin/ads-manager/ads-file-field"
import { AdsField } from "@/components/features/admin/ads-manager/ads-manager-ui"
import type { GoogleDraft } from "@/components/features/admin/ads-manager/ads-google-create-fields"

export function AdsPmaxCreateFields({
  draft,
  onChange,
}: {
  draft: GoogleDraft
  onChange: (draft: GoogleDraft) => void
}) {
  const set = (patch: Partial<GoogleDraft>) => onChange({ ...draft, ...patch })
  return (
    <>
      <AdsField label="Long headlines" hint="One per line. At least 1, 90 characters each.">
        <Textarea value={draft.longHeadlines} onChange={(event) => set({ longHeadlines: event.target.value })} />
      </AdsField>
      <AdsField label="Business name" hint="25 characters.">
        <Input value={draft.businessName} onChange={(event) => set({ businessName: event.target.value })} />
      </AdsField>
      <AdsFileField
        label="Marketing image"
        hint="Landscape JPEG, PNG, or GIF. 4 MB max."
        role="marketing_image"
        value={draft.marketingImage}
        onChange={(marketingImage) => set({ marketingImage })}
      />
      <AdsFileField
        label="Square image"
        hint="Square JPEG, PNG, or GIF."
        role="square_image"
        value={draft.squareImage}
        onChange={(squareImage) => set({ squareImage })}
      />
      <AdsFileField
        label="Logo"
        hint="Square logo. JPEG, PNG, or GIF."
        role="logo"
        value={draft.logo}
        onChange={(logo) => set({ logo })}
      />
      <AdsField label="YouTube video" hint="Optional. Paste a YouTube link or 11-character id.">
        <Input value={draft.youtube} onChange={(event) => set({ youtube: event.target.value })} />
      </AdsField>
    </>
  )
}
