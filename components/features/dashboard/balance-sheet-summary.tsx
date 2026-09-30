import { Card, CardContent } from "@/components/ui/card"
import type { SellerBalanceSheetSummary } from "@/lib/types/sellerBalanceSheet"

interface BalanceSheetSummaryProps {
  summary: SellerBalanceSheetSummary
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

export function BalanceSheetSummary({ summary }: BalanceSheetSummaryProps) {
  const cards = [
    { label: "Inventory listings", value: String(summary.inventoryListings) },
    { label: "Inventory asking value", value: formatUsd(summary.inventoryAskingValue) },
    { label: "Inventory cost basis", value: formatUsd(summary.inventoryCostBasis) },
    { label: "Realized sales", value: String(summary.realizedSales) },
    { label: "Gross sold", value: formatUsd(summary.grossSales) },
    { label: "Reswell fees", value: formatUsd(summary.reswellFees) },
    { label: "Sold cost basis", value: formatUsd(summary.recordedCostBasis) },
    { label: "Realized profit", value: formatUsd(summary.realizedProfit) },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
