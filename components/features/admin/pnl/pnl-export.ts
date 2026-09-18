import type { BalanceSheetSummary, PnlComputedEntry } from "@/lib/pnl-calc"
import { realizedLosses, sourceDisplay, sourceKindLabel, statusLabel } from "@/lib/pnl-calc"

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return ""
  const str = String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

const CSV_HEADERS = [
  "Title",
  "Source",
  "Bought From",
  "Status",
  "Purchase Date",
  "Purchase Price",
  "Asking Price",
  "Shipping",
  "Platform Fee",
  "Other Costs",
  "Total Cost",
  "Sale Date",
  "Sale Price",
  "Profit",
  "Margin %",
  "ROI %",
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
  sheet: BalanceSheetSummary
}

function buildSummaryRows(ctx: PnlCsvExportContext, rows: PnlComputedEntry[]): string[][] {
  const { sheet } = ctx
  const lossTotal = realizedLosses(rows)
  const exportedAt = new Date().toISOString().slice(0, 10)

  return [
    ["Reswell inventory export"],
    ["Scope", ctx.scopeLabel],
    ["Exported", exportedAt],
    [],
    ["--- Balance sheet (filtered rows) ---"],
    ["Metric", "Value"],
    ["Boards held", String(sheet.heldCount)],
    ["Inventory at cost", money(sheet.inventoryCost)],
    ["Asking value", money(sheet.askingValue)],
    ["Unrealized markup", money(sheet.unrealizedMarkup)],
    ["Bought on Reswell (held)", `${sheet.reswellHeldCount} / ${money(sheet.reswellInventoryCost)}`],
    ["Bought outside (held)", `${sheet.outsideHeldCount} / ${money(sheet.outsideInventoryCost)}`],
    ["Sold", String(sheet.soldCount)],
    ["Realized profit", money(sheet.realizedProfit)],
    ["Realized losses (losing sales)", lossTotal > 0 ? money(lossTotal) : "0.00"],
    [],
    ["--- Boards ---"],
  ]
}

export function buildPnlCsv(rows: PnlComputedEntry[], ctx?: PnlCsvExportContext): string {
  const boardLines = rows.map((row) => [
    row.board_name,
    sourceKindLabel(row.source_kind),
    sourceDisplay(row),
    statusLabel(row.status),
    row.purchase_date ?? "",
    money(row.purchase_price),
    money(row.asking_price),
    money(row.shipping_cost),
    money(row.platform_fee),
    money(row.other_costs),
    money(row.totalCost),
    row.sale_date ?? "",
    money(row.sale_price),
    money(row.profit),
    percent(row.margin),
    percent(row.roi),
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
  link.download = `reswell-inventory-${ctx.scope}-${stamp}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
