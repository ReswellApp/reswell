"use client"

import { TrendingUp, TrendingDown, Package, DollarSign, Receipt, Percent } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatCurrency, formatPercent, type PnlSummary } from "@/lib/pnl-calc"

interface PnlSummaryCardsProps {
  summary: PnlSummary
  /** When set, metrics are scoped to this calendar month. */
  periodLabel?: string
}

export function PnlSummaryCards({ summary, periodLabel }: PnlSummaryCardsProps) {
  const scopeSuffix = periodLabel ? ` · ${periodLabel}` : ""
  const profitable = summary.netProfit >= 0

  const cards = [
    {
      label: "Net profit",
      value: formatCurrency(summary.netProfit),
      icon: profitable ? TrendingUp : TrendingDown,
      accent: profitable ? "text-emerald-600" : "text-rose-600",
      sub: `${summary.soldCount} sold${scopeSuffix}`,
    },
    {
      label: "Revenue",
      value: formatCurrency(summary.totalRevenue),
      icon: DollarSign,
      accent: "text-foreground",
      sub: `Gross sale proceeds${scopeSuffix}`,
    },
    {
      label: "Spent",
      value: formatCurrency(summary.totalSpent),
      icon: Receipt,
      accent: "text-foreground",
      sub: `incl. ${formatCurrency(summary.totalFees)} fees`,
    },
    {
      label: "ROI",
      value: formatPercent(summary.roi),
      icon: Percent,
      accent: profitable ? "text-emerald-600" : "text-rose-600",
      sub: `${formatPercent(summary.margin)} margin`,
    },
    {
      label: "Inventory",
      value: formatCurrency(summary.inventoryCostBasis),
      icon: Package,
      accent: "text-foreground",
      sub: `${summary.inventoryCount + summary.listedCount} boards held`,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.label}>
            <CardContent className="flex flex-col gap-1 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </span>
                <Icon className={cn("h-4 w-4", card.accent)} aria-hidden />
              </div>
              <span className={cn("text-2xl font-bold tabular-nums", card.accent)}>
                {card.value}
              </span>
              <span className="truncate text-xs text-muted-foreground">{card.sub}</span>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
