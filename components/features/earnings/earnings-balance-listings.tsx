"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { EarningsBalanceListingRow } from "@/lib/earnings-balance-listings"
import { EarningsListingThumb } from "./earnings-listing-thumb"

function formatMoney(n: number): string {
  return `$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function displayTitle(row: EarningsBalanceListingRow): string {
  if (row.extraListingCount > 0) return `${row.title} + ${row.extraListingCount} more`
  return row.title
}

export function EarningsBalanceListingsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-40" />
      <Card className="border-border/80 shadow-sm">
        <CardContent className="p-0 divide-y divide-border/60">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-9 w-9 rounded-md shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-[55%] max-w-xs" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function BalanceSaleRow({ row }: { row: EarningsBalanceListingRow }) {
  const pending = row.status === "pending"
  return (
    <li className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
      {row.saleHref ? (
        <Link
          href={row.saleHref}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <EarningsListingThumb src={row.imageUrl} alt="" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{displayTitle(row)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {pending ? "Pending until the order is confirmed" : "Ready to use or cash out"}
            </p>
          </div>
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <EarningsListingThumb src={row.imageUrl} alt="" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{displayTitle(row)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {pending ? "Pending until the order is confirmed" : "Ready to use or cash out"}
            </p>
          </div>
        </div>
      )}
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-foreground">+{formatMoney(row.amountUsd)}</p>
        {row.listingHref ? (
          <Link
            href={row.listingHref}
            className="mt-0.5 block text-[11px] font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            View listing
          </Link>
        ) : null}
      </div>
    </li>
  )
}

function BalanceGroup({
  title,
  caption,
  totalUsd,
  rows,
  empty,
}: {
  title: string
  caption: string
  totalUsd: number
  rows: EarningsBalanceListingRow[]
  empty: string
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">{caption}</p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-foreground">{formatMoney(totalUsd)}</p>
      </div>
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground text-center leading-relaxed">{empty}</p>
          ) : (
            <ul className="divide-y divide-border/60" role="list">
              {rows.map((row) => (
                <BalanceSaleRow key={row.key} row={row} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

export function EarningsBalanceListings({
  pending,
  ready,
  pendingTotalUsd,
  readyTotalUsd,
  isLoading,
}: {
  pending: EarningsBalanceListingRow[]
  ready: EarningsBalanceListingRow[]
  pendingTotalUsd: number
  readyTotalUsd: number
  isLoading: boolean
}) {
  if (isLoading) return <EarningsBalanceListingsSkeleton />

  const showReady = readyTotalUsd > 0 || ready.length > 0
  const showPending = pendingTotalUsd > 0 || pending.length > 0
  if (!showReady && !showPending) return null

  return (
    <div className="space-y-8">
      {showPending ? (
        <BalanceGroup
          title="Pending until order confirmed"
          caption="These sales are still in your pending balance. They unlock after delivery or pickup is confirmed."
          totalUsd={pendingTotalUsd}
          rows={pending}
          empty="No pending sales right now."
        />
      ) : null}
      {showReady ? (
        <BalanceGroup
          title="Ready from these sales"
          caption="Listings that make up your ready balance — money you can spend on Reswell or send to your bank."
          totalUsd={readyTotalUsd}
          rows={ready}
          empty="Nothing is ready yet. Pending sales will move here when the order is confirmed."
        />
      ) : null}
    </div>
  )
}
