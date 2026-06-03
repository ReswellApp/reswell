import type { PnlComputedEntry } from "@/lib/pnl-calc"
import { statusLabel } from "@/lib/pnl-calc"

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

export function buildPnlCsv(rows: PnlComputedEntry[]): string {
  const lines = rows.map((row) => [
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

  return [CSV_HEADERS, ...lines].map((line) => line.map(csvCell).join(",")).join("\n")
}

export function downloadPnlCsv(rows: PnlComputedEntry[], scope: string): void {
  const csv = buildPnlCsv(rows)
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  const stamp = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `reswell-pnl-${scope}-${stamp}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
