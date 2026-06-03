/**
 * Pure profit-and-loss math for the surfboard P&L tracker. No side effects so
 * it is shared by the server (summaries) and client (live table) alike.
 */
import type { PnlEntryRow, PnlStatus } from "@/lib/db/pnl"
import type { PnlLoanWithRepayments } from "@/lib/db/pnlLoans"

export interface PnlComputedEntry extends PnlEntryRow {
  /** purchase_price + shipping + platform fee + other costs */
  totalCost: number
  /** sale_price when present, else 0 */
  revenue: number
  /** Realized net profit; null until the board is sold. */
  profit: number | null
  /** profit / revenue, null when not sold or revenue is 0. */
  margin: number | null
  /** profit / totalCost, null when not sold or cost is 0. */
  roi: number | null
}

export interface PnlSummary {
  entryCount: number
  soldCount: number
  listedCount: number
  inventoryCount: number
  /** Capital deployed across every entry (cost basis incl. fees). */
  totalSpent: number
  /** Gross sale proceeds from sold boards. */
  totalRevenue: number
  /** Realized net profit from sold boards. */
  netProfit: number
  /** Cost basis still tied up in unsold inventory. */
  inventoryCostBasis: number
  /** Fees + shipping + other costs paid across sold boards. */
  totalFees: number
  /** netProfit / cost basis of sold boards. */
  roi: number | null
  /** netProfit / totalRevenue. */
  margin: number | null
}

function n(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

export function computeEntry(entry: PnlEntryRow): PnlComputedEntry {
  const totalCost =
    n(entry.purchase_price) + n(entry.shipping_cost) + n(entry.platform_fee) + n(entry.other_costs)
  const isSold = entry.status === "sold" || entry.sale_price != null
  const revenue = n(entry.sale_price)
  const profit = isSold ? revenue - totalCost : null
  const margin = profit != null && revenue > 0 ? profit / revenue : null
  const roi = profit != null && totalCost > 0 ? profit / totalCost : null

  return { ...entry, totalCost, revenue, profit, margin, roi }
}

export function summarize(entries: PnlComputedEntry[]): PnlSummary {
  let soldCount = 0
  let listedCount = 0
  let inventoryCount = 0
  let totalSpent = 0
  let totalRevenue = 0
  let netProfit = 0
  let inventoryCostBasis = 0
  let totalFees = 0
  let soldCostBasis = 0

  for (const e of entries) {
    totalSpent += e.totalCost
    const isSold = e.profit != null
    if (isSold) {
      soldCount += 1
      totalRevenue += e.revenue
      netProfit += e.profit ?? 0
      totalFees += n(e.shipping_cost) + n(e.platform_fee) + n(e.other_costs)
      soldCostBasis += e.totalCost
    } else {
      inventoryCostBasis += e.totalCost
      if (e.status === "listed") listedCount += 1
      else inventoryCount += 1
    }
  }

  return {
    entryCount: entries.length,
    soldCount,
    listedCount,
    inventoryCount,
    totalSpent,
    totalRevenue,
    netProfit,
    inventoryCostBasis,
    totalFees,
    roi: soldCostBasis > 0 ? netProfit / soldCostBasis : null,
    margin: totalRevenue > 0 ? netProfit / totalRevenue : null,
  }
}

export interface LoanSummary {
  loanCount: number
  totalPrincipal: number
  totalRepaid: number
  /** principal − repaid, floored at 0. */
  outstanding: number
  /** repaid / principal, 0–1. */
  repaidProgress: number
}

export function summarizeLoans(loans: PnlLoanWithRepayments[]): LoanSummary {
  let totalPrincipal = 0
  let totalRepaid = 0
  for (const loan of loans) {
    totalPrincipal += n(loan.principal)
    for (const r of loan.repayments) totalRepaid += n(r.amount)
  }
  const outstanding = Math.max(0, totalPrincipal - totalRepaid)
  return {
    loanCount: loans.length,
    totalPrincipal,
    totalRepaid,
    outstanding,
    repaidProgress: totalPrincipal > 0 ? Math.min(1, totalRepaid / totalPrincipal) : 0,
  }
}

export interface CapitalSummary {
  /** Total loaned (principal across all loans). */
  principal: number
  /** Capital deployed into boards (cost basis of every entry). */
  deployed: number
  /** Cash recovered from sold boards. */
  recovered: number
  /** Repaid to lenders. */
  repaid: number
  /** principal − deployed + recovered − repaid: liquid loan cash left to deploy. */
  cashAvailable: number
  /** Cost basis still tied up in unsold inventory. */
  inventoryCostBasis: number
  /** principal − repaid: what is still owed. */
  outstanding: number
  /** cashAvailable + inventory value (at cost) − outstanding: operation equity. */
  netPosition: number
  /** deployed-minus-recovered against principal, 0–1+ (how leveraged you are). */
  utilization: number
}

/**
 * Ties the loan pool to the P&L. When the loan is fully repaid and all boards
 * are sold, netPosition collapses to realized net profit.
 */
export function computeCapital(summary: PnlSummary, loans: LoanSummary): CapitalSummary {
  const principal = loans.totalPrincipal
  const deployed = summary.totalSpent
  const recovered = summary.totalRevenue
  const repaid = loans.totalRepaid
  const cashAvailable = principal - deployed + recovered - repaid
  const outstanding = loans.outstanding
  const netPosition = cashAvailable + summary.inventoryCostBasis - outstanding
  const netDeployed = Math.max(0, deployed - recovered)
  return {
    principal,
    deployed,
    recovered,
    repaid,
    cashAvailable,
    inventoryCostBasis: summary.inventoryCostBasis,
    outstanding,
    netPosition,
    utilization: principal > 0 ? netDeployed / principal : 0,
  }
}

/**
 * Month key (YYYY-MM) a board is attributed to: sale month when sold, else the
 * purchase month. Used for the month filter and grouping.
 */
export function entryMonthKey(entry: PnlEntryRow): string | null {
  const date = entry.sale_date ?? entry.purchase_date
  return date ? date.slice(0, 7) : null
}

export function statusLabel(status: PnlStatus): string {
  switch (status) {
    case "sold":
      return "Sold"
    case "listed":
      return "Listed"
    default:
      return "Inventory"
  }
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  })
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${(value * 100).toFixed(1)}%`
}

/** "2026-06" -> "Jun 2026" for the month dropdown. */
export function formatMonthKey(key: string): string {
  const [year, month] = key.split("-").map(Number)
  if (!year || !month) return key
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}
