"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { EarningsTransaction } from "./earnings-types"
import { availableEarningsListingRows } from "./earnings-activity-helpers"
import { EarningsListingThumb } from "./earnings-listing-thumb"

function formatMoney(n: number): string {
  return `$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function EarningsAvailableListingsSkeleton() {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardContent className="p-0 divide-y divide-border/60">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-9 w-9 rounded-md shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-[55%] max-w-xs" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function EarningsAvailableListings({
  transactions,
  reversedOrderIds,
  isLoading,
}: {
  transactions: EarningsTransaction[]
  reversedOrderIds: Set<string>
  isLoading: boolean
}) {
  if (isLoading) return <EarningsAvailableListingsSkeleton />

  const rows = availableEarningsListingRows(transactions, reversedOrderIds)
  if (rows.length === 0) return null

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">Available from these listings</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">
          Sales that recently unlocked into your ready balance. Open a sale to see the order, or the
          listing name to view the item.
        </p>
      </div>
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardContent className="p-0">
          <ul className="divide-y divide-border/60" role="list">
            {rows.map((row) => {
              const extra =
                row.extraListingCount > 0
                  ? ` + ${row.extraListingCount} more`
                  : ""
              const title = `${row.title}${extra}`
              return (
                <li key={row.key} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  {row.saleHref ? (
                    <Link
                      href={row.saleHref}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <EarningsListingThumb src={row.imageUrl} alt="" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Ready to use or cash out</p>
                      </div>
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <EarningsListingThumb src={row.imageUrl} alt="" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Ready to use or cash out</p>
                      </div>
                    </div>
                  )}
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {row.amountUsd > 0 ? `+${formatMoney(row.amountUsd)}` : "Ready"}
                    </p>
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
            })}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}
