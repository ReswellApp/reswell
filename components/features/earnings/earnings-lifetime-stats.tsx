"use client"

import { Banknote, TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { SellerEarningsDashboardTotals } from "@/lib/db/sellerEarningsTotals"
import type { EarningsWalletSnapshot } from "./earnings-types"

export function EarningsLifetimeStatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardContent className="p-5 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-40" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-8 w-40" />
        </CardContent>
      </Card>
    </div>
  )
}

export function EarningsLifetimeStats({
  wallet,
  sellerOrderTotals,
  isLoading,
}: {
  wallet: EarningsWalletSnapshot | null
  /** When present, reflects sum of seller earnings from all non-refunded orders. */
  sellerOrderTotals: SellerEarningsDashboardTotals | null
  isLoading: boolean
}) {
  if (isLoading) {
    return <EarningsLifetimeStatsSkeleton />
  }

  if (!wallet) {
    return null
  }

  const lifetimeEarned = sellerOrderTotals
    ? sellerOrderTotals.lifetimeSoldUsd
    : parseFloat(wallet.lifetime_earned)
  const lifetimeCashedOut = parseFloat(wallet.lifetime_cashed_out)

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <TrendingUp className="h-4 w-4" />
            Lifetime earned
          </div>
          <div className="text-2xl font-bold tabular-nums">${lifetimeEarned.toFixed(2)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Banknote className="h-4 w-4" />
            Total cashed out
          </div>
          <div className="text-2xl font-bold tabular-nums">${lifetimeCashedOut.toFixed(2)}</div>
        </CardContent>
      </Card>
    </div>
  )
}
