import { Button } from "@/components/ui/button"
import { AdsVerdictBadge, platformLabel } from "@/components/features/admin/ads-manager/ads-manager-ui"
import { formatAdsConversions, formatAdsMoney, formatAdsRatio } from "@/lib/ads/manager/format"
import type { AdVerdict, AdsMetrics, AdsPlatform, DeliveryStatus } from "@/lib/types/adsManager"

export interface AdsTableRow {
  key: string
  platform: AdsPlatform
  entity: "campaign" | "ad_group" | "ad" | "keyword"
  id: string
  parentId?: string
  kind?: "ad_group" | "ad_set" | "asset_group"
  name: string
  subtitle: string
  status: DeliveryStatus
  currency: string
  metrics: AdsMetrics
  verdict: AdVerdict
}

export function AdsEntityTable({
  rows,
  busyKey,
  onEdit,
  onToggle,
}: {
  rows: AdsTableRow[]
  busyKey: string | null
  onEdit: (row: AdsTableRow) => void
  onToggle: (row: AdsTableRow) => void
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        Nothing in this view.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Spend</th>
            <th className="px-3 py-2 font-medium">Conv.</th>
            <th className="px-3 py-2 font-medium">CPA</th>
            <th className="px-3 py-2 font-medium">ROAS</th>
            <th className="px-3 py-2 font-medium">Read</th>
            <th className="px-3 py-2 font-medium"> </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const busy = busyKey === row.key
            const live = row.status === "enabled"
            return (
              <tr key={row.key} className="border-b border-border last:border-0">
                <td className="px-3 py-3">
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {platformLabel(row.platform)} · {row.subtitle}
                  </p>
                </td>
                <td className="px-3 py-3 tabular-nums">{formatAdsMoney(row.metrics.spend, row.currency)}</td>
                <td className="px-3 py-3 tabular-nums">{formatAdsConversions(row.metrics.conversions)}</td>
                <td className="px-3 py-3 tabular-nums">{formatAdsMoney(row.metrics.cpa, row.currency)}</td>
                <td className="px-3 py-3 tabular-nums">{formatAdsRatio(row.metrics.roas, "multiple")}</td>
                <td className="px-3 py-3">
                  <AdsVerdictBadge verdict={row.verdict} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">
                    {row.status === "enabled" || row.status === "paused" ? (
                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onToggle(row)}>
                        {live ? "Pause" : "Enable"}
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onEdit(row)}>
                      Edit
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
