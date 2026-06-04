import type { CapitalSummary, PnlComputedEntry, PnlSummary } from "@/lib/pnl-calc"
import { realizedLosses, statusLabel } from "@/lib/pnl-calc"

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return ""
  const str = String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

const CSV_HEADERS = [
  "Board Name",
  "Category",
  "Status",
  "Purchase Date",
  "Purchase Price",
  "Shipping",
  "Platform Fee",
  "Other Costs",
  "Total Cost",
  "Sale Date",
  "Sale Price",
  "Profit",
  "Margin %",
  "ROI %",
  "Source",
  "Order #",
  "Notes",
] as const

function money(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "" : value.toFixed(2)
}

function percent(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "" : (value * 100).toFixed(1)
}

export interface PnlCsvExportContext {
  /** Filename segment, e.g. `all` or `2026-06`. */
  scope: string
  /** Human-readable filter label in the CSV header. */
  scopeLabel: string
  summary: PnlSummary
  capital: CapitalSummary
}

function buildSummaryRows(ctx: PnlCsvExportContext, rows: PnlComputedEntry[]): string[][] {
  const { summary, capital } = ctx
  const lossTotal = realizedLosses(rows)
  const exportedAt = new Date().toISOString().slice(0, 10)

  return [
    ["Reswell P&L Export"],
    ["Scope", ctx.scopeLabel],
    ["Exported", exportedAt],
    [],
    ["--- P&L (filtered rows) ---"],
    ["Metric", "Value"],
    ["Boards in export", String(summary.entryCount)],
    ["Sold", String(summary.soldCount)],
    ["Held (inventory + listed)", String(summary.inventoryCount + summary.listedCount)],
    ["Net profit", money(summary.netProfit)],
    ["Realized losses (losing sales)", lossTotal > 0 ? money(lossTotal) : "0.00"],
    ["Revenue", money(summary.totalRevenue)],
    ["Total spent (cost basis)", money(summary.totalSpent)],
    ["Inventory tied up (filtered)", money(summary.inventoryCostBasis)],
    ["Fees (sold boards)", money(summary.totalFees)],
    ["ROI %", percent(summary.roi)],
    ["Margin %", percent(summary.margin)],
    [],
    ["--- Capital & liquidity (all boards & loans) ---"],
    ["Metric", "Value"],
    ["Cash available to deploy", money(capital.cashAvailable)],
    ["Inventory tied up (all)", money(capital.inventoryCostBasis)],
    ["Loan principal", money(capital.principal)],
    ["Deployed", money(capital.deployed)],
    ["Recovered from sales", money(capital.recovered)],
    ["Repaid to lenders", money(capital.repaid)],
    ["Outstanding owed", money(capital.outstanding)],
    ["Net position", money(capital.netPosition)],
    [],
    ["--- Boards ---"],
  ]
}

export function buildPnlCsv(rows: PnlComputedEntry[], ctx?: PnlCsvExportContext): string {
  const boardLines = rows.map((row) => [
    row.board_name,
    row.category ?? "",
    statusLabel(row.status),
    row.purchase_date ?? "",
    money(row.purchase_price),
    money(row.shipping_cost),
    money(row.platform_fee),
    money(row.other_costs),
    money(row.totalCost),
    row.sale_date ?? "",
    money(row.sale_price),
    money(row.profit),
    percent(row.margin),
    percent(row.roi),
    row.order_id ? `Reswell ${row.order_role === "seller" ? "sale" : "purchase"}` : "Manual",
    row.order_num ?? "",
    row.notes ?? "",
  ])

  const sections: string[][][] = []
  if (ctx) {
    sections.push(buildSummaryRows(ctx, rows))
  }
  sections.push([[...CSV_HEADERS]], boardLines)

  return sections
    .flat()
    .map((line) => line.map(csvCell).join(","))
    .join("\n")
}

export function downloadPnlCsv(rows: PnlComputedEntry[], ctx: PnlCsvExportContext): void {
  const csv = buildPnlCsv(rows, ctx)
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  const stamp = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `reswell-pnl-${ctx.scope}-${stamp}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
