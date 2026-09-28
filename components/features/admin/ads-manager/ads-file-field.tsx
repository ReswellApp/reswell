"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { AdsField } from "@/components/features/admin/ads-manager/ads-manager-ui"
import { uploadAdsMedia } from "@/components/features/admin/ads-manager/upload-ads-media"
import type { AdsMediaRole } from "@/lib/types/adsManager"

const ACCEPT: Record<AdsMediaRole, string> = {
  marketing_image: "image/jpeg,image/png,image/gif",
  square_image: "image/jpeg,image/png,image/gif",
  logo: "image/jpeg,image/png,image/gif",
  meta_image: "image/jpeg,image/png,image/gif,image/webp",
  meta_video: "video/mp4,video/quicktime",
}

export function AdsFileField({
  label,
  hint,
  role,
  value,
  onChange,
}: {
  label: string
  hint?: string
  role: AdsMediaRole
  value: string
  onChange: (resource: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onFile(file: File | undefined) {
    if (!file) return
    setPending(true)
    setError(null)
    try {
      const uploaded = await uploadAdsMedia(file, role)
      onChange(uploaded.resource)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <AdsField label={label} hint={value ? "Uploaded." : hint}>
      <Input
        type="file"
        accept={ACCEPT[role]}
        disabled={pending}
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      {pending ? <span className="block text-xs text-muted-foreground">Uploading…</span> : null}
      {error ? <span className="block text-xs text-destructive">{error}</span> : null}
    </AdsField>
  )
}
