"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { EarningsTransaction } from "./earnings-types"

function monthBoundsLocal(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

export function EarningsMonthlySummarySkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function EarningsMonthlySummary({
  transactions,
  isLoading,
  hasMoreActivity,
}: {
  transactions: EarningsTransaction[]
  isLoading: boolean
  hasMoreActivity: boolean
}) {
  const { credits, debits, monthLabel } = useMemo(() => {
    const { start, end } = monthBoundsLocal()
    let c = 0
    let d = 0
    for (const t of transactions) {
      const ts = new Date(t.created_at).getTime()
      if (ts < start.getTime() || ts > end.getTime()) continue
      const amt = parseFloat(t.amount)
      if (!Number.isFinite(amt)) continue
      if (amt > 0) c += amt
      else if (amt < 0) d += amt
    }
    const label = start.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    return { credits: c, debits: d, monthLabel: label }
  }, [transactions])

  if (isLoading) {
    return <EarningsMonthlySummarySkeleton />
  }

  const net = credits + debits
  const hasAny = transactions.length > 0

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">This month</h2>
      <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
        Totals include only transactions in {monthLabel} that are already loaded below.
        {hasMoreActivity ? " Load more activity to widen coverage for older dates." : ""}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Credits
            </div>
            <div className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {hasAny ? `+$${credits.toFixed(2)}` : "—"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">Money in from loaded lines</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Debits
            </div>
            <div className="text-2xl font-bold tabular-nums text-rose-700 dark:text-rose-400">
              {hasAny && debits !== 0 ? `−$${Math.abs(debits).toFixed(2)}` : hasAny ? "$0.00" : "—"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">Refunds, purchases, payouts…</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Net (loaded)
            </div>
            <div
              className={`text-2xl font-bold tabular-nums ${
                net >= 0 ? "text-foreground" : "text-rose-700 dark:text-rose-400"
              }`}
            >
              {hasAny ? `${net >= 0 ? "+" : "−"}$${Math.abs(net).toFixed(2)}` : "—"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">Credits minus debits</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
