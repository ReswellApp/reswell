"use client"

import { buildListingsDeskAnalytics, type ListingsDeskAnalyticsInput } from "@/lib/listings-desk-analytics"
import { cn } from "@/lib/utils"

interface ListingsAdvancedAnalyticsProps {
  listings: ListingsDeskAnalyticsInput[]
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatRate(rate: number | null): string {
  if (rate == null) return "—"
  return `${Math.round(rate * 1000) / 10}%`
}

function formatCount(value: number | null, digits = 0): string {
  if (value == null) return "—"
  return value.toLocaleString(undefined, { maximumFractionDigits: digits })
}

const BAR_WIDTH_CLASSES = [
  "w-1/12",
  "w-2/12",
  "w-3/12",
  "w-4/12",
  "w-5/12",
  "w-6/12",
  "w-7/12",
  "w-8/12",
  "w-9/12",
  "w-10/12",
  "w-11/12",
  "w-full",
] as const

function barWidthClass(ratio: number): string {
  const index = Math.min(
    BAR_WIDTH_CLASSES.length - 1,
    Math.max(0, Math.round(ratio * (BAR_WIDTH_CLASSES.length - 1))),
  )
  return BAR_WIDTH_CLASSES[index] ?? "w-full"
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card px-4 py-3.5 shadow-sm">
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      {detail ? <p className="mt-1 text-[12px] text-muted-foreground">{detail}</p> : null}
    </div>
  )
}

export function ListingsAdvancedAnalytics({ listings }: ListingsAdvancedAnalyticsProps) {
  const stats = buildListingsDeskAnalytics(listings)
  const maxSectionCount = Math.max(1, ...stats.bySection.map((section) => section.count))

  return (
    <section className="space-y-4" aria-labelledby="listings-analytics-heading">
      <div>
        <h2 id="listings-analytics-heading" className="text-base font-semibold text-foreground">
          Shop analytics
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Totals across every listing in your shop, including drafts and sold items.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Live listings" value={formatCount(stats.active)} detail="Visible and pending sale" />
        <Metric label="On vacation" value={formatCount(stats.vacation)} detail={`${formatCount(stats.drafts)} drafts`} />
        <Metric
          label="Asking value"
          value={formatMoney(stats.inventoryValueUsd)}
          detail={
            stats.averageActivePriceUsd == null
              ? "No live prices yet"
              : `${formatMoney(stats.averageActivePriceUsd)} average`
          }
        />
        <Metric label="Sold value" value={formatMoney(stats.soldValueUsd)} detail={`${formatCount(stats.sold)} sold`} />
        <Metric label="Views" value={formatCount(stats.totalViews)} detail={`${formatCount(stats.averageViews, 1)} avg / listing`} />
        <Metric label="Saves" value={formatCount(stats.totalSaves)} detail={`${formatRate(stats.saveRate)} of views`} />
        <Metric label="In carts" value={formatCount(stats.totalCarts)} detail={`${formatRate(stats.cartRate)} of views`} />
        <Metric label="Added this month" value={formatCount(stats.listedThisMonth)} detail={`${formatCount(stats.total)} in the shop`} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">By category</h3>
          {stats.bySection.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No listings yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {stats.bySection.map((section) => (
                <li key={section.section}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">{section.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {section.count} · {section.views.toLocaleString()} views
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full bg-primary",
                        barWidthClass(section.count / maxSectionCount),
                      )}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">Most viewed</h3>
          {stats.topByViews.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Views will show up here.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {stats.topByViews.map((listing) => (
                <li key={listing.id}>
                  <a
                    href={`#listing-editor-${listing.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <span className="truncate font-medium text-foreground">{listing.title}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {listing.views.toLocaleString()} views
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}
