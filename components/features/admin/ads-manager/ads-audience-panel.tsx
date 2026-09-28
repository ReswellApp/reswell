"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { applyAdsAudienceAction, type AdsActionResult } from "@/lib/actions/adsManager"
import { AdsSavedAudienceForm } from "@/components/features/admin/ads-manager/ads-saved-audience-form"
import { AdsField, AdsSelect, platformLabel } from "@/components/features/admin/ads-manager/ads-manager-ui"
import type { ManagedAdGroup, ManagedAudience } from "@/lib/types/adsManager"

export function AdsAudiencePanel({
  audiences,
  adGroups,
  query,
  onDone,
}: {
  audiences: ManagedAudience[]
  adGroups: ManagedAdGroup[]
  query: string
  onDone: (result: AdsActionResult) => void
}) {
  const needle = query.trim().toLowerCase()
  const rows = audiences.filter((audience) => {
    if (!needle) return true
    return `${audience.name} ${audience.kindLabel}`.toLowerCase().includes(needle)
  })

  return (
    <div className="space-y-4">
      <ApplyAudienceForm audiences={audiences} adGroups={adGroups} onDone={onDone} />
      <AdsSavedAudienceForm onDone={onDone} />
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No audiences in this view.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Kind</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Platform</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((audience) => (
                <tr key={`${audience.platform}:${audience.kind}:${audience.id}`} className="border-b border-border last:border-0">
                  <td className="px-3 py-3">{audience.name}</td>
                  <td className="px-3 py-3 text-muted-foreground">{audience.kindLabel}</td>
                  <td className="px-3 py-3">{audience.size == null ? "—" : audience.size.toLocaleString()}</td>
                  <td className="px-3 py-3">{platformLabel(audience.platform)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ApplyAudienceForm({
  audiences,
  adGroups,
  onDone,
}: {
  audiences: ManagedAudience[]
  adGroups: ManagedAdGroup[]
  onDone: (result: AdsActionResult) => void
}) {
  const options = audiences.map((audience) => ({
    value: `${audience.platform}:${audience.kind}:${audience.id}`,
    label: `${audience.name} · ${audience.kindLabel}`,
    audience,
  }))
  const [selected, setSelected] = useState(options[0]?.value ?? "")
  const audience = options.find((option) => option.value === selected)?.audience ?? null
  const targets = useMemo(() => targetsFor(audience, adGroups), [audience, adGroups])
  const [targetId, setTargetId] = useState(targets[0]?.id ?? "")
  const [pending, setPending] = useState(false)
  const currentTarget = targets.some((target) => target.id === targetId) ? targetId : (targets[0]?.id ?? "")

  async function submit() {
    if (!audience || !currentTarget) {
      onDone({ error: "Choose an audience and a destination" })
      return
    }
    const payload = audiencePayload(audience, currentTarget)
    if (!payload.ok) {
      onDone({ error: payload.error })
      return
    }
    setPending(true)
    const result = await applyAdsAudienceAction(payload.body)
    setPending(false)
    onDone(result)
  }

  if (options.length === 0) return null

  return (
    <div className="grid gap-3 rounded-xl border border-border p-4">
      <p className="text-sm font-medium">Apply an audience</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <AdsField label="Audience">
          <AdsSelect value={selected} onChange={setSelected} options={options.map(({ value, label }) => ({ value, label }))} />
        </AdsField>
        <AdsField label={audience?.platform === "meta" ? "Ad set" : "Ad group"}>
          <AdsSelect
            value={currentTarget}
            onChange={setTargetId}
            options={targets.map((target) => ({ value: target.id, label: target.name }))}
          />
        </AdsField>
      </div>
      <Button type="button" size="sm" disabled={pending || !currentTarget} onClick={() => void submit()}>
        {pending ? "Applying…" : "Apply"}
      </Button>
    </div>
  )
}

function audiencePayload(
  audience: ManagedAudience,
  targetId: string,
): { ok: true; body: Parameters<typeof applyAdsAudienceAction>[0] } | { ok: false; error: string } {
  if (audience.platform === "google" && (audience.kind === "user_list" || audience.kind === "google_audience")) {
    return {
      ok: true,
      body: { platform: "google", audienceId: audience.id, audienceKind: audience.kind, adGroupId: targetId },
    }
  }
  if (audience.platform === "meta" && (audience.kind === "saved" || audience.kind === "custom")) {
    return {
      ok: true,
      body: { platform: "meta", audienceId: audience.id, audienceKind: audience.kind, adSetId: targetId },
    }
  }
  return { ok: false, error: "That audience cannot be applied here" }
}

function targetsFor(audience: ManagedAudience | null, adGroups: ManagedAdGroup[]): ManagedAdGroup[] {
  if (!audience) return []
  if (audience.platform === "google" && (audience.kind === "user_list" || audience.kind === "google_audience")) {
    return adGroups.filter((group) => group.platform === "google" && group.kind === "ad_group")
  }
  if (audience.platform === "meta" && (audience.kind === "saved" || audience.kind === "custom")) {
    return adGroups.filter((group) => group.platform === "meta" && group.kind === "ad_set")
  }
  return []
}
