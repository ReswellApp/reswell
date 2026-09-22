"use client"

import { formatCurrency, type BalanceSheetSummary } from "@/lib/pnl-calc"
import { cn } from "@/lib/utils"

interface PnlBalanceSheetProps {
  sheet: BalanceSheetSummary
  periodLabel?: string
  missingCostCount?: number
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint?: string
  accent?: string
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-background px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xl font-semibold tabular-nums", accent)}>{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

export function PnlBalanceSheet({ sheet, periodLabel, missingCostCount = 0 }: PnlBalanceSheetProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        label={periodLabel ? `At cost · ${periodLabel}` : "At cost"}
        value={formatCurrency(sheet.inventoryCost)}
        hint={`${sheet.heldCount} held${missingCostCount > 0 ? ` · ${missingCostCount} missing cost` : ""}`}
      />
      <Stat
        label="Asking value"
        value={formatCurrency(sheet.askingValue)}
        hint={`${sheet.askingPricedCount} of ${sheet.heldCount} priced`}
      />
      <Stat
        label="Unrealized markup"
        value={formatCurrency(sheet.unrealizedMarkup)}
        hint="Asking minus cost"
        accent={
          sheet.askingPricedCount === 0
            ? "text-muted-foreground"
            : sheet.unrealizedMarkup >= 0
              ? "text-emerald-600"
              : "text-rose-600"
        }
      />
      <Stat
        label="Realized profit"
        value={formatCurrency(sheet.realizedProfit)}
        hint={`${sheet.soldCount} sold`}
        accent={
          sheet.soldCount === 0
            ? "text-muted-foreground"
            : sheet.realizedProfit >= 0
              ? "text-emerald-600"
              : "text-rose-600"
        }
      />
    </div>
  )
}
