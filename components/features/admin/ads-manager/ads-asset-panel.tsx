"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { removePmaxAssetAction, type AdsActionResult } from "@/lib/actions/adsManager"
import { AdsAssetForm } from "@/components/features/admin/ads-manager/ads-asset-form"
import type { ManagedAdGroup, ManagedCreativeAsset } from "@/lib/types/adsManager"

export function AdsAssetPanel({
  assets,
  adGroups,
  query,
  onDone,
}: {
  assets: ManagedCreativeAsset[]
  adGroups: ManagedAdGroup[]
  query: string
  onDone: (result: AdsActionResult) => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const needle = query.trim().toLowerCase()
  const rows = assets.filter((asset) => {
    if (!needle) return true
    const haystack = `${asset.fieldLabel} ${asset.text ?? ""} ${asset.youtubeId ?? ""}`.toLowerCase()
    return haystack.includes(needle)
  })

  async function remove(asset: ManagedCreativeAsset) {
    if (!window.confirm("Remove this asset from the group?")) return
    setBusy(asset.id)
    const result = await removePmaxAssetAction({ linkResource: asset.linkResource, confirm: true })
    setBusy(null)
    onDone(result)
  }

  return (
    <div className="space-y-4">
      <AdsAssetForm adGroups={adGroups} onDone={onDone} />
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No Performance Max assets in this view.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Field</th>
                <th className="px-3 py-2 font-medium">Content</th>
                <th className="px-3 py-2 font-medium">Group</th>
                <th className="px-3 py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((asset) => (
                <tr key={asset.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-3">{asset.fieldLabel}</td>
                  <td className="px-3 py-3">
                    <AssetContent asset={asset} />
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{asset.assetGroupId}</td>
                  <td className="px-3 py-3 text-right">
                    <Button type="button" size="sm" variant="outline" disabled={busy === asset.id} onClick={() => void remove(asset)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AssetContent({ asset }: { asset: ManagedCreativeAsset }) {
  if (asset.youtubeId) {
    return (
      <a className="underline" href={`https://www.youtube.com/watch?v=${asset.youtubeId}`} target="_blank" rel="noreferrer">
        {asset.youtubeId}
      </a>
    )
  }
  if (asset.previewUrl) {
    return (
      <a className="underline" href={asset.previewUrl} target="_blank" rel="noreferrer">
        Preview
      </a>
    )
  }
  return <span>{asset.text || "—"}</span>
}
