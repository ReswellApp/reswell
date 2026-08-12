import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type {
  AdSalesChannel,
  AdSalesListingRow,
  AdSalesOrderRow,
} from "@/lib/services/adAttributedSales"

const CHANNEL_LABEL: Record<AdSalesChannel, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  meta_referral: "Meta referral",
}

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  })
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-US")
}

function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

function channelBadgeClass(channel: AdSalesChannel): string {
  if (channel === "google_ads") return "bg-blue-50 text-blue-700 border-blue-200"
  if (channel === "meta_ads") return "bg-indigo-50 text-indigo-700 border-indigo-200"
  return "bg-slate-100 text-slate-700 border-slate-200"
}

export function AdSalesListingsTable({ rows }: { rows: AdSalesListingRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No attributed listing sales in this view.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Listing</th>
            <th className="px-3 py-2 font-medium">Channel</th>
            <th className="px-3 py-2 font-medium text-right">Items</th>
            <th className="px-3 py-2 font-medium text-right">Revenue</th>
            <th className="px-3 py-2 font-medium">Campaign / source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.dataSource}:${row.channel}:${row.listingId}`} className="border-b border-border last:border-0">
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-3">
                  {row.thumbnailUrl ? (
                    <Image
                      src={row.thumbnailUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0">
                    {row.href ? (
                      <Link href={row.href} className="font-medium hover:underline" target="_blank">
                        {row.title}
                        <ArrowUpRight className="ml-1 inline h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="font-medium">{row.title}</span>
                    )}
                    <p className="truncate text-xs text-muted-foreground">
                      {row.matched ? row.status ?? "matched" : "Not in listings table"}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5">
                <Badge variant="outline" className={cn("font-normal", channelBadgeClass(row.channel))}>
                  {CHANNEL_LABEL[row.channel]}
                </Badge>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(row.itemsPurchased)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatUsd(row.revenue)}</td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">
                <p>{row.campaigns[0] ?? "—"}</p>
                <p>{row.sourceMediums[0]}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AdSalesOrdersTable({ rows }: { rows: AdSalesOrderRow[] }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium">Matched orders</h2>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No attributed listing sales in this view.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Listing</th>
                <th className="px-3 py-2 font-medium">Channel</th>
                <th className="px-3 py-2 font-medium text-right">Revenue</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Click ID</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.dataSource}:${row.orderId}:${row.listingId}:${row.channel}`}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/orders/${row.orderId}`} className="font-medium hover:underline">
                      {row.orderNum}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {row.createdAt ? formatDateLabel(row.createdAt.slice(0, 10)) : "—"} · {row.status}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">{row.listingTitle}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className={cn("font-normal", channelBadgeClass(row.channel))}>
                      {CHANNEL_LABEL[row.channel]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatUsd(row.revenue)}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {row.source} / {row.medium}
                    {row.campaign ? <p>{row.campaign}</p> : null}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                    {row.clickId ? `${row.clickId.slice(0, 16)}…` : "—"}
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
