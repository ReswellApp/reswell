"use client"

import { Landmark } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatCurrency, type BalanceSheetSummary } from "@/lib/pnl-calc"

interface PnlBalanceSheetProps {
  sheet: BalanceSheetSummary
  periodLabel?: string
}

function SheetRow({
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
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm text-muted-foreground">{label}</div>
        {hint ? <div className="text-xs text-muted-foreground/80">{hint}</div> : null}
      </div>
      <div className={cn("shrink-0 text-right text-base font-semibold tabular-nums", accent)}>{value}</div>
    </div>
  )
}

export function PnlBalanceSheet({ sheet, periodLabel }: PnlBalanceSheetProps) {
  const markupPositive = sheet.unrealizedMarkup >= 0
  const profitPositive = sheet.realizedProfit >= 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Landmark className="h-5 w-5 text-neutral-800" aria-hidden />
          Balance sheet
          {periodLabel ? (
            <span className="text-sm font-normal text-muted-foreground">· {periodLabel}</span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Inventory
          </h3>
          <SheetRow
            label="At cost"
            value={formatCurrency(sheet.inventoryCost)}
            hint={`${sheet.heldCount} board${sheet.heldCount === 1 ? "" : "s"} held`}
          />
          <SheetRow
            label="Asking value"
            value={formatCurrency(sheet.askingValue)}
            hint={
              sheet.heldCount === 0
                ? "No boards held"
                : `${sheet.askingPricedCount} of ${sheet.heldCount} priced`
            }
          />
          <SheetRow
            label="Unrealized markup"
            value={formatCurrency(sheet.unrealizedMarkup)}
            hint="Asking minus cost on priced boards"
            accent={
              sheet.askingPricedCount === 0
                ? "text-muted-foreground"
                : markupPositive
                  ? "text-emerald-600"
                  : "text-rose-600"
            }
          />
        </section>

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bought from
          </h3>
          <SheetRow
            label="Reswell"
            value={formatCurrency(sheet.reswellInventoryCost)}
            hint={`${sheet.reswellHeldCount} held`}
          />
          <SheetRow
            label="Outside Reswell"
            value={formatCurrency(sheet.outsideInventoryCost)}
            hint={`${sheet.outsideHeldCount} held`}
          />
          {sheet.soldCount > 0 ? (
            <SheetRow
              label="Realized profit"
              value={formatCurrency(sheet.realizedProfit)}
              hint={`${sheet.soldCount} sold`}
              accent={profitPositive ? "text-emerald-600" : "text-rose-600"}
            />
          ) : null}
        </section>
      </CardContent>
    </Card>
  )
}
