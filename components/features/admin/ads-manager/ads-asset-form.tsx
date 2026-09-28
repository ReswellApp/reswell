"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addPmaxAssetAction, type AdsActionResult } from "@/lib/actions/adsManager"
import { parseYoutubeId } from "@/lib/ads/manager/media"
import { AdsFileField } from "@/components/features/admin/ads-manager/ads-file-field"
import { AdsField, AdsSelect } from "@/components/features/admin/ads-manager/ads-manager-ui"
import type { ManagedAdGroup } from "@/lib/types/adsManager"

const TEXT_FIELDS = [
  { value: "HEADLINE", label: "Headline" },
  { value: "LONG_HEADLINE", label: "Long headline" },
  { value: "DESCRIPTION", label: "Description" },
  { value: "BUSINESS_NAME", label: "Business name" },
] as const

const IMAGE_FIELDS = [
  { value: "MARKETING_IMAGE", label: "Marketing image", role: "marketing_image" },
  { value: "SQUARE_MARKETING_IMAGE", label: "Square image", role: "square_image" },
  { value: "LOGO", label: "Logo", role: "logo" },
] as const

export function AdsAssetForm({
  adGroups,
  onDone,
}: {
  adGroups: ManagedAdGroup[]
  onDone: (result: AdsActionResult) => void
}) {
  const groups = adGroups.filter((group) => group.platform === "google" && group.kind === "asset_group")
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "")
  const [mode, setMode] = useState<"text" | "image" | "youtube">("text")
  const [fieldType, setFieldType] = useState<string>("HEADLINE")
  const [text, setText] = useState("")
  const [assetResource, setAssetResource] = useState("")
  const [youtube, setYoutube] = useState("")
  const [pending, setPending] = useState(false)

  const imageField = IMAGE_FIELDS.find((field) => field.value === fieldType) ?? IMAGE_FIELDS[0]

  async function submit() {
    const payload = buildPayload({ mode, groupId, fieldType, text, assetResource, youtube, imageField: imageField.value })
    if (!payload.ok) {
      onDone({ error: payload.error })
      return
    }
    setPending(true)
    const result = await addPmaxAssetAction(payload.body)
    setPending(false)
    onDone(result)
  }

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">No Performance Max asset groups in this account yet.</p>
  }

  return (
    <div className="grid gap-3 rounded-xl border border-border p-4">
      <p className="text-sm font-medium">Add an asset</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <AdsField label="Asset group">
          <AdsSelect
            value={groupId}
            onChange={setGroupId}
            options={groups.map((group) => ({ value: group.id, label: group.name }))}
          />
        </AdsField>
        <AdsField label="Kind">
          <AdsSelect
            value={mode}
            onChange={(value) => {
              const next = value === "image" || value === "youtube" ? value : "text"
              setMode(next)
              setFieldType(next === "image" ? "MARKETING_IMAGE" : "HEADLINE")
            }}
            options={[
              { value: "text", label: "Text" },
              { value: "image", label: "Image" },
              { value: "youtube", label: "YouTube video" },
            ]}
          />
        </AdsField>
      </div>
      {mode === "text" ? (
        <>
          <AdsField label="Field">
            <AdsSelect value={fieldType} onChange={setFieldType} options={[...TEXT_FIELDS]} />
          </AdsField>
          <AdsField label="Text">
            <Input value={text} onChange={(event) => setText(event.target.value)} />
          </AdsField>
        </>
      ) : null}
      {mode === "image" ? (
        <>
          <AdsField label="Field">
            <AdsSelect
              value={imageField.value}
              onChange={setFieldType}
              options={IMAGE_FIELDS.map((field) => ({ value: field.value, label: field.label }))}
            />
          </AdsField>
          <AdsFileField
            label="Image file"
            hint="JPEG, PNG, or GIF. 4 MB max."
            role={imageField.role}
            value={assetResource}
            onChange={setAssetResource}
          />
        </>
      ) : null}
      {mode === "youtube" ? (
        <AdsField label="YouTube link or id">
          <Input value={youtube} onChange={(event) => setYoutube(event.target.value)} />
        </AdsField>
      ) : null}
      <Button type="button" size="sm" disabled={pending} onClick={() => void submit()}>
        {pending ? "Adding…" : "Add asset"}
      </Button>
    </div>
  )
}

function buildPayload(input: {
  mode: "text" | "image" | "youtube"
  groupId: string
  fieldType: string
  text: string
  assetResource: string
  youtube: string
  imageField: string
}): { ok: true; body: Record<string, unknown> } | { ok: false; error: string } {
  if (!input.groupId) return { ok: false, error: "Choose an asset group" }
  if (input.mode === "text") {
    return {
      ok: true,
      body: { assetKind: "text", assetGroupId: input.groupId, fieldType: input.fieldType, text: input.text.trim() },
    }
  }
  if (input.mode === "image") {
    if (!input.assetResource) return { ok: false, error: "Upload the image first" }
    return {
      ok: true,
      body: {
        assetKind: "image",
        assetGroupId: input.groupId,
        fieldType: input.imageField,
        assetResource: input.assetResource,
      },
    }
  }
  const youtubeVideoId = parseYoutubeId(input.youtube)
  if (!youtubeVideoId) return { ok: false, error: "Use a YouTube link or 11-character id" }
  return { ok: true, body: { assetKind: "youtube", assetGroupId: input.groupId, youtubeVideoId } }
}
