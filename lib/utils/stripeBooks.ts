import type {
  StripeBooksBalanceTransaction,
  StripeBooksCategory,
  StripeBooksCategoryTotal,
  StripeBooksCoverage,
  StripeBooksFeeDetail,
  StripeBooksLedgerSnapshot,
  StripeBooksMonthBucket,
  StripeBooksPeriod,
  StripeBooksReport,
  StripeBooksTxnRow,
} from "@/lib/types/stripeBooks"
import {
  BUSINESS_TIMEZONE,
  BUSINESS_TIMEZONE_LABEL,
  addBusinessDays,
  businessDayKeyFromMs,
  businessDayStartMs,
} from "@/lib/utils/business-timezone"
import { formatMonthKey } from "@/lib/utils/adminRevenueMonthly"
import {
  stripeBooksMonthSchema,
  stripeBooksRangeSchema,
  type StripeBooksQuery,
} from "@/lib/validations/stripeBooks"

export { BUSINESS_TIMEZONE, BUSINESS_TIMEZONE_LABEL }

export const STRIPE_BOOKS_TXN_PAGE_CAP = 15000
export const STRIPE_BOOKS_RECENT_TXN_LIMIT = 250

type CategoryMeta = {
  label: string
  glAccount: string
  bookType: "pnl" | "balance_sheet"
}

export const STRIPE_BOOKS_CATEGORY_META: Record<StripeBooksCategory, CategoryMeta> = {
  card_volume: {
    label: "Card charges (gross)",
    glAccount: "Stripe clearing — customer receipts",
    bookType: "balance_sheet",
  },
  stripe_processing_fee: {
    label: "Stripe processing fees",
    glAccount: "Payment processing expense",
    bookType: "pnl",
  },
  connect_fee: {
    label: "Stripe Connect fees",
    glAccount: "Stripe Connect expense",
    bookType: "pnl",
  },
  instant_payout_fee: {
    label: "Stripe Instant Payout fees",
    glAccount: "Instant payout expense",
    bookType: "pnl",
  },
  refund: {
    label: "Refunds",
    glAccount: "Sales returns / refunds",
    bookType: "pnl",
  },
  dispute: {
    label: "Disputes / chargebacks",
    glAccount: "Dispute expense",
    bookType: "pnl",
  },
  seller_transfer: {
    label: "Seller Connect transfers",
    glAccount: "Seller payables (cash-out)",
    bookType: "balance_sheet",
  },
  transfer_reversal: {
    label: "Transfer reversals",
    glAccount: "Seller payables (reversal)",
    bookType: "balance_sheet",
  },
  platform_payout: {
    label: "Payouts to Mercury",
    glAccount: "Mercury cash ← Stripe cash",
    bookType: "balance_sheet",
  },
  payout_reversal: {
    label: "Payout failures / returns",
    glAccount: "Stripe cash ← Mercury cash",
    bookType: "balance_sheet",
  },
  topup: {
    label: "Bank top-ups into Stripe",
    glAccount: "Stripe cash ← Mercury cash",
    bookType: "balance_sheet",
  },
  topup_reversal: {
    label: "Top-up reversals",
    glAccount: "Mercury cash ← Stripe cash",
    bookType: "balance_sheet",
  },
  adjustment: {
    label: "Stripe adjustments",
    glAccount: "Stripe clearing adjustments",
    bookType: "pnl",
  },
  reserve: {
    label: "Reserves / holds",
    glAccount: "Stripe reserved funds",
    bookType: "balance_sheet",
  },
  other: {
    label: "Other Stripe activity",
    glAccount: "Review — uncategorized",
    bookType: "pnl",
  },
}

const CONNECT_FEE_RE = /\bconnect\b/i
const INSTANT_FEE_RE = /\binstant\b/i

export function usdToCents(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value ?? 0)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

export function centsToUsdNumber(cents: number): number {
  return Math.round(cents) / 100
}

export function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export function parseStripeBooksSearch(params: {
  month?: string | string[] | undefined
  range?: string | string[] | undefined
  format?: string | string[] | undefined
}): StripeBooksQuery {
  const month = stripeBooksMonthSchema.safeParse(firstSearchParam(params.month)?.trim())
  const range = stripeBooksRangeSchema.safeParse(firstSearchParam(params.range)?.trim())
  const formatRaw = firstSearchParam(params.format)?.trim()
  const format = formatRaw === "json" || formatRaw === "csv" ? formatRaw : undefined
  return {
    ...(month.success ? { month: month.data } : {}),
    ...(range.success ? { range: range.data } : {}),
    ...(format ? { format } : {}),
  }
}

export function resolveStripeBooksPeriod(
  query: StripeBooksQuery,
  nowMs = Date.now(),
): StripeBooksPeriod {
  if (query.month) {
    const startMs = businessDayStartMs(`${query.month}-01`)
    const nextMonth = nextYearMonth(query.month)
    const endMs = businessDayStartMs(`${nextMonth}-01`)
    return {
      mode: "month",
      label: formatMonthKey(query.month),
      yearMonth: query.month,
      createdGte: unixSeconds(startMs),
      createdLt: unixSeconds(endMs),
      startIso: new Date(startMs).toISOString(),
      endIsoExclusive: new Date(endMs).toISOString(),
    }
  }

  const range = query.range ?? "all"
  if (range === "all") {
    return {
      mode: "all",
      label: "All time",
      yearMonth: null,
      createdGte: null,
      createdLt: null,
      startIso: null,
      endIsoExclusive: null,
    }
  }

  if (range === "ytd") {
    const todayKey = businessDayKeyFromMs(nowMs)
    const startMs = businessDayStartMs(`${todayKey.slice(0, 4)}-01-01`)
    return {
      mode: "ytd",
      label: `Year to date ${todayKey.slice(0, 4)}`,
      yearMonth: null,
      createdGte: unixSeconds(startMs),
      createdLt: unixSeconds(nowMs),
      startIso: new Date(startMs).toISOString(),
      endIsoExclusive: new Date(nowMs).toISOString(),
    }
  }

  const days = range === "90d" ? 90 : 30
  const todayKey = businessDayKeyFromMs(nowMs)
  const startKey = addBusinessDays(todayKey, -(days - 1))
  const startMs = businessDayStartMs(startKey)
  return {
    mode: range,
    label: range === "90d" ? "Past 3 months" : "Last 30 days",
    yearMonth: null,
    createdGte: unixSeconds(startMs),
    createdLt: unixSeconds(nowMs),
    startIso: new Date(startMs).toISOString(),
    endIsoExclusive: new Date(nowMs).toISOString(),
  }
}

function unixSeconds(ms: number): number {
  return Math.floor(ms / 1000)
}

function nextYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number)
  const shifted = new Date(Date.UTC(year, month, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`
}

export function isoFromUnix(seconds: number): string {
  return new Date(seconds * 1000).toISOString()
}

export function yearMonthFromUnix(seconds: number): string {
  return businessDayKeyFromMs(seconds * 1000).slice(0, 7)
}

function blob(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ").toLowerCase()
}

export function splitStripeFeeDetails(details: StripeBooksFeeDetail[]): {
  processingFeeCents: number
  connectFeeCents: number
  instantFeeCents: number
  otherFeeCents: number
} {
  let processingFeeCents = 0
  let connectFeeCents = 0
  let instantFeeCents = 0
  let otherFeeCents = 0
  for (const detail of details) {
    const text = blob([detail.type, detail.description])
    if (CONNECT_FEE_RE.test(text) || detail.type === "application_fee") {
      connectFeeCents += detail.amount
    } else if (INSTANT_FEE_RE.test(text)) {
      instantFeeCents += detail.amount
    } else if (detail.type === "stripe_fee" || detail.type === "tax") {
      processingFeeCents += detail.amount
    } else {
      otherFeeCents += detail.amount
    }
  }
  return { processingFeeCents, connectFeeCents, instantFeeCents, otherFeeCents }
}

export function categorizeStripeBalanceTransaction(
  txn: StripeBooksBalanceTransaction,
): StripeBooksTxnRow {
  const fees = splitStripeFeeDetails(txn.feeDetails)
  const feeRemainder = txn.fee - (fees.processingFeeCents + fees.connectFeeCents + fees.instantFeeCents + fees.otherFeeCents)
  if (feeRemainder !== 0 && txn.feeDetails.length === 0) {
    fees.processingFeeCents += txn.fee
  } else if (feeRemainder !== 0) {
    fees.otherFeeCents += feeRemainder
  }

  const category = categoryForBalanceTransaction(txn)
  const meta = STRIPE_BOOKS_CATEGORY_META[category]
  return {
    id: txn.id,
    createdIso: isoFromUnix(txn.created),
    type: txn.type,
    category,
    categoryLabel: meta.label,
    description: txn.description?.trim() || txn.type,
    amountCents: txn.amount,
    feeCents: txn.fee,
    processingFeeCents: fees.processingFeeCents,
    connectFeeCents: fees.connectFeeCents,
    instantFeeCents: fees.instantFeeCents,
    netCents: txn.net,
    sourceId: txn.sourceId,
    status: txn.status,
  }
}

export function categoryForBalanceTransaction(
  txn: Pick<StripeBooksBalanceTransaction, "type" | "reportingCategory" | "description">,
): StripeBooksCategory {
  const type = txn.type.toLowerCase()
  const reporting = (txn.reportingCategory ?? "").toLowerCase()
  const text = blob([type, reporting, txn.description])

  if (type === "charge" || type === "payment") return "card_volume"
  if (type === "refund" || type === "payment_refund" || reporting === "refund" || reporting === "refund_failure") {
    return "refund"
  }
  if (
    type.includes("dispute") ||
    reporting.includes("dispute") ||
    (type === "adjustment" && text.includes("dispute"))
  ) {
    return "dispute"
  }
  if (
    type === "transfer" ||
    type === "connect_collection_transfer" ||
    reporting === "transfer" ||
    reporting === "connect_collection_transfer"
  ) {
    return "seller_transfer"
  }
  if (
    type === "transfer_refund" ||
    type === "transfer_cancel" ||
    type === "transfer_failure" ||
    type === "transfer_reversal" ||
    reporting === "transfer_reversal"
  ) {
    return "transfer_reversal"
  }
  if (type === "payout" || reporting === "payout" || reporting === "financing_payout") return "platform_payout"
  if (
    type === "payout_cancel" ||
    type === "payout_failure" ||
    type === "payout_minimum_balance_release" ||
    reporting === "payout_reversal"
  ) {
    return "payout_reversal"
  }
  if (type === "topup" || reporting === "topup") return "topup"
  if (type === "topup_reversal" || reporting === "topup_reversal") return "topup_reversal"
  if (type.includes("reserve") || reporting.includes("reserve")) return "reserve"
  if (
    type === "application_fee" ||
    type === "application_fee_refund" ||
    reporting === "platform_earning" ||
    reporting === "platform_earning_refund" ||
    reporting === "network_cost"
  ) {
    return "connect_fee"
  }
  if (
    type === "stripe_fee" ||
    type === "stripe_fx_fee" ||
    type === "tax_fee" ||
    reporting === "fee" ||
    reporting === "tax"
  ) {
    if (CONNECT_FEE_RE.test(text)) return "connect_fee"
    if (INSTANT_FEE_RE.test(text)) return "instant_payout_fee"
    return "stripe_processing_fee"
  }
  if (type === "adjustment" || reporting === "other_adjustment") return "adjustment"
  return "other"
}

export function emptyCategoryTotals(): StripeBooksCategoryTotal[] {
  return (Object.keys(STRIPE_BOOKS_CATEGORY_META) as StripeBooksCategory[]).map((category) => ({
    category,
    label: STRIPE_BOOKS_CATEGORY_META[category].label,
    glAccount: STRIPE_BOOKS_CATEGORY_META[category].glAccount,
    bookType: STRIPE_BOOKS_CATEGORY_META[category].bookType,
    count: 0,
    amountCents: 0,
    feeCents: 0,
    netCents: 0,
  }))
}

export function aggregateStripeBooksTransactions(rows: StripeBooksTxnRow[]): {
  categories: StripeBooksCategoryTotal[]
  months: StripeBooksMonthBucket[]
  stripeNetChangeCents: number
  unexplainedOtherCents: number
  processingFeeCents: number
  connectFeeCents: number
  instantFeeCents: number
} {
  const byCategory = new Map(emptyCategoryTotals().map((row) => [row.category, row]))
  const byMonth = new Map<string, StripeBooksMonthBucket>()
  let stripeNetChangeCents = 0
  let processingFeeCents = 0
  let connectFeeCents = 0
  let instantFeeCents = 0

  for (const row of rows) {
    const bucket = byCategory.get(row.category)
    if (bucket) {
      bucket.count += 1
      bucket.amountCents += row.amountCents
      bucket.feeCents += row.feeCents
      bucket.netCents += row.netCents
    }
    stripeNetChangeCents += row.netCents
    processingFeeCents += row.processingFeeCents
    connectFeeCents += row.connectFeeCents
    instantFeeCents += row.instantFeeCents
    if (row.category === "stripe_processing_fee" && row.processingFeeCents === 0) {
      processingFeeCents += Math.abs(row.netCents || row.amountCents)
    }
    if (row.category === "connect_fee" && row.connectFeeCents === 0) {
      connectFeeCents += Math.abs(row.netCents || row.amountCents)
    }
    if (row.category === "instant_payout_fee" && row.instantFeeCents === 0) {
      instantFeeCents += Math.abs(row.netCents || row.amountCents)
    }

    const yearMonth = yearMonthFromUnix(Math.floor(Date.parse(row.createdIso) / 1000))
    const month = byMonth.get(yearMonth) ?? emptyMonthBucket(yearMonth)
    month.netChangeCents += row.netCents
    if (row.category === "card_volume") month.cardVolumeCents += row.amountCents
    month.processingFeeCents += row.processingFeeCents
    month.connectFeeCents += row.connectFeeCents
    if (row.category === "stripe_processing_fee" && row.processingFeeCents === 0) {
      month.processingFeeCents += Math.abs(row.netCents || row.amountCents)
    }
    if (row.category === "connect_fee" && row.connectFeeCents === 0) {
      month.connectFeeCents += Math.abs(row.netCents || row.amountCents)
    }
    if (row.category === "refund") month.refundCents += row.amountCents
    if (row.category === "seller_transfer") month.sellerTransferCents += row.amountCents
    if (row.category === "platform_payout") month.platformPayoutCents += row.amountCents
    if (row.category === "topup") month.topupCents += row.amountCents
    byMonth.set(yearMonth, month)
  }

  const other = byCategory.get("other")
  return {
    categories: [...byCategory.values()],
    months: [...byMonth.values()].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth)),
    stripeNetChangeCents,
    unexplainedOtherCents: other?.netCents ?? 0,
    processingFeeCents,
    connectFeeCents,
    instantFeeCents,
  }
}

function emptyMonthBucket(yearMonth: string): StripeBooksMonthBucket {
  return {
    yearMonth,
    cardVolumeCents: 0,
    processingFeeCents: 0,
    connectFeeCents: 0,
    refundCents: 0,
    sellerTransferCents: 0,
    platformPayoutCents: 0,
    topupCents: 0,
    netChangeCents: 0,
  }
}

export function emptyLedgerSnapshot(): StripeBooksLedgerSnapshot {
  return {
    walletAvailableCents: 0,
    walletPendingCents: 0,
    walletOwedCents: 0,
    walletLifetimeEarnedCents: 0,
    walletLifetimeCashedOutCents: 0,
    connectTransferGrossCents: 0,
    connectTransferFeeCents: 0,
    connectTransferNetCents: 0,
    connectTransferCount: 0,
    instantCashoutCount: 0,
    confirmedOrderCount: 0,
    stripeOrderCount: 0,
    cardOrderVolumeCents: 0,
    marketplaceFeeCents: 0,
    sellerEarningsCents: 0,
    shippingCollectedCents: 0,
    promoMarketingCents: 0,
    tipRevenueCents: 0,
    refundedOrderCount: 0,
  }
}

export function coverageFromSnapshots(
  stripeAvailableCents: number,
  stripePendingCents: number,
  ledger: Pick<StripeBooksLedgerSnapshot, "walletAvailableCents" | "walletPendingCents">,
): StripeBooksCoverage {
  return {
    stripeAvailableCents,
    sellerAvailableCents: ledger.walletAvailableCents,
    surplusCents: stripeAvailableCents - ledger.walletAvailableCents,
    stripePendingCents,
    sellerPendingCents: ledger.walletPendingCents,
  }
}

export function isStripeCardPaymentMethod(method: string | null | undefined): boolean {
  const value = (method ?? "").trim().toLowerCase()
  return value === "stripe" || value === "card"
}

export function stripeBooksHref(query: { range?: string; month?: string | null }): string {
  const params = new URLSearchParams()
  if (query.month) params.set("month", query.month)
  else if (query.range && query.range !== "all") params.set("range", query.range)
  const qs = params.toString()
  return qs ? `/admin/stripe-books?${qs}` : "/admin/stripe-books"
}

export function stripeBooksCsvHref(period: StripeBooksPeriod): string {
  const params = new URLSearchParams({ format: "csv" })
  if (period.yearMonth) params.set("month", period.yearMonth)
  else if (period.mode !== "all") params.set("range", period.mode)
  return `/api/admin/stripe-books?${params.toString()}`
}

function csvCell(value: string | number): string {
  const text = String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function stripeBooksReportToCsv(report: StripeBooksReport): string {
  const lines: string[] = []
  lines.push("Reswell Stripe books")
  lines.push(`Generated,${csvCell(report.generatedAtIso)}`)
  lines.push(`Timezone,${csvCell(report.timezone)}`)
  lines.push(`Period,${csvCell(report.period.label)}`)
  lines.push(`Stripe account,${csvCell(report.stripeAccountId ?? "")}`)
  lines.push(`Livemode,${report.livemode === null ? "" : String(report.livemode)}`)
  lines.push(`Transactions,${report.transactionCount}`)
  lines.push(`Truncated,${String(report.truncated)}`)
  lines.push("")
  lines.push("Current Stripe balance (USD cents)")
  lines.push("available,pending,connect_reserved,instant_available,total")
  if (report.balance) {
    lines.push(
      [
        report.balance.availableCents,
        report.balance.pendingCents,
        report.balance.connectReservedCents,
        report.balance.instantAvailableCents,
        report.balance.totalCents,
      ].join(","),
    )
  }
  lines.push("")
  lines.push("Coverage")
  lines.push("stripe_available,seller_wallet_available,surplus_or_deficit,stripe_pending,seller_wallet_pending")
  lines.push(
    [
      report.coverage.stripeAvailableCents,
      report.coverage.sellerAvailableCents,
      report.coverage.surplusCents,
      report.coverage.stripePendingCents,
      report.coverage.sellerPendingCents,
    ].join(","),
  )
  lines.push("")
  lines.push("Internal ledger (USD cents)")
  lines.push(
    [
      "marketplace_fee",
      "seller_earnings",
      "shipping_collected",
      "promo_marketing",
      "tip_revenue",
      "connect_transfers_gross",
      "connect_instant_fee_kept",
      "wallet_available",
      "wallet_pending",
      "wallet_cashed_out",
    ].join(","),
  )
  lines.push(
    [
      report.ledger.marketplaceFeeCents,
      report.ledger.sellerEarningsCents,
      report.ledger.shippingCollectedCents,
      report.ledger.promoMarketingCents,
      report.ledger.tipRevenueCents,
      report.ledger.connectTransferGrossCents,
      report.ledger.connectTransferFeeCents,
      report.ledger.walletAvailableCents,
      report.ledger.walletPendingCents,
      report.ledger.walletLifetimeCashedOutCents,
    ].join(","),
  )
  lines.push("")
  lines.push("Stripe activity by category")
  lines.push("category,label,gl_account,book_type,count,amount_cents,fee_cents,net_cents")
  for (const row of report.categories) {
    lines.push(
      [
        csvCell(row.category),
        csvCell(row.label),
        csvCell(row.glAccount),
        csvCell(row.bookType),
        row.count,
        row.amountCents,
        row.feeCents,
        row.netCents,
      ].join(","),
    )
  }
  lines.push("")
  lines.push("Monthly Stripe activity")
  lines.push(
    "month,card_volume_cents,processing_fee_cents,connect_fee_cents,refund_cents,seller_transfer_cents,platform_payout_cents,topup_cents,net_change_cents",
  )
  for (const row of report.months) {
    lines.push(
      [
        row.yearMonth,
        row.cardVolumeCents,
        row.processingFeeCents,
        row.connectFeeCents,
        row.refundCents,
        row.sellerTransferCents,
        row.platformPayoutCents,
        row.topupCents,
        row.netChangeCents,
      ].join(","),
    )
  }
  lines.push("")
  lines.push("Balance transactions")
  lines.push(
    "id,created,type,category,description,amount_cents,fee_cents,processing_fee_cents,connect_fee_cents,instant_fee_cents,net_cents,source,status",
  )
  for (const row of report.transactions) {
    lines.push(
      [
        csvCell(row.id),
        csvCell(row.createdIso),
        csvCell(row.type),
        csvCell(row.category),
        csvCell(row.description),
        row.amountCents,
        row.feeCents,
        row.processingFeeCents,
        row.connectFeeCents,
        row.instantFeeCents,
        row.netCents,
        csvCell(row.sourceId ?? ""),
        csvCell(row.status),
      ].join(","),
    )
  }
  lines.push("")
  lines.push("Platform payouts")
  lines.push("id,created,arrival,amount_cents,status,method,destination")
  for (const row of report.payouts) {
    lines.push(
      [
        csvCell(row.id),
        csvCell(row.createdIso),
        csvCell(row.arrivalIso ?? ""),
        row.amountCents,
        csvCell(row.status),
        csvCell(row.method ?? ""),
        csvCell(row.destination ?? ""),
      ].join(","),
    )
  }
  lines.push("")
  lines.push("Top-ups")
  lines.push("id,created,amount_cents,status")
  for (const row of report.topups) {
    lines.push(
      [csvCell(row.id), csvCell(row.createdIso), row.amountCents, csvCell(row.status)].join(","),
    )
  }
  return `${lines.join("\n")}\n`
}

export function recentStripeBooksTransactions(
  rows: StripeBooksTxnRow[],
  limit = STRIPE_BOOKS_RECENT_TXN_LIMIT,
): StripeBooksTxnRow[] {
  return [...rows]
    .sort((a, b) => b.createdIso.localeCompare(a.createdIso))
    .slice(0, limit)
}
