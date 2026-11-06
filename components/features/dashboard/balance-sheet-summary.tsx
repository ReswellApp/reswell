import { Card, CardContent } from "@/components/ui/card"
import type { SellerBalanceSheetSummary } from "@/lib/types/sellerBalanceSheet"
import { balanceSheetPeriodLabel } from "@/lib/utils/balance-sheet-query"
import type { BalanceSheetPeriod } from "@/lib/validations/seller-balance-sheet"

interface BalanceSheetSummaryProps {
  summary: SellerBalanceSheetSummary
  period: BalanceSheetPeriod
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function MetricCard({
  label,
  value,
  emphasize,
}: {
  label: string
  value: string
  emphasize?: "positive" | "negative" | "neutral"
}) {
  const valueClass =
    emphasize === "positive"
      ? "text-emerald-700 dark:text-emerald-400"
      : emphasize === "negative"
        ? "text-destructive"
        : undefined

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`mt-1 text-xl font-semibold tabular-nums ${valueClass ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

export function BalanceSheetSummary({ summary, period }: BalanceSheetSummaryProps) {
  const periodLabel = balanceSheetPeriodLabel(period)
  const avgProfit =
    summary.realizedSales > 0 ? summary.realizedProfit / summary.realizedSales : null
  const netMargin =
    summary.grossSales > 0 ? (summary.realizedProfit / summary.grossSales) * 100 : null
  const profitEmphasize =
    summary.realizedProfit > 0 ? "positive" : summary.realizedProfit < 0 ? "negative" : "neutral"

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Active inventory</h2>
          <p className="text-xs text-muted-foreground">
            What you currently have listed and what you paid for it.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Listings" value={String(summary.inventoryListings)} />
          <MetricCard label="Asking value" value={formatUsd(summary.inventoryAskingValue)} />
          <MetricCard label="Cost basis" value={formatUsd(summary.inventoryCostBasis)} />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">P&L · {periodLabel}</h2>
          <p className="text-xs text-muted-foreground">
            Realized flips in this window after Reswell fees and recorded cost basis.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="Items sold" value={String(summary.realizedSales)} />
          <MetricCard label="Gross sold" value={formatUsd(summary.grossSales)} />
          <MetricCard label="Reswell fees" value={formatUsd(summary.reswellFees)} />
          <MetricCard label="Sold cost basis" value={formatUsd(summary.recordedCostBasis)} />
          <MetricCard
            label="Realized profit"
            value={formatUsd(summary.realizedProfit)}
            emphasize={profitEmphasize}
          />
          <MetricCard
            label="Avg profit / sale"
            value={avgProfit == null ? "—" : formatUsd(avgProfit)}
            emphasize={
              avgProfit == null ? "neutral" : avgProfit >= 0 ? "positive" : "negative"
            }
          />
        </div>
        {netMargin != null ? (
          <p className="text-xs text-muted-foreground">
            Net margin on gross sold:{" "}
            <span
              className={
                netMargin >= 0
                  ? "font-medium text-emerald-700 dark:text-emerald-400"
                  : "font-medium text-destructive"
              }
            >
              {netMargin.toFixed(1)}%
            </span>
            {summary.missingCostBasis > 0
              ? " · Profit only includes sales with a paid price recorded."
              : null}
          </p>
        ) : null}
      </section>
    </div>
  )
}
