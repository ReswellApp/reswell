import type Stripe from "stripe"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe-server"
import { loadStripeBooksLedgerSnapshot } from "@/lib/db/stripeBooks"
import type {
  StripeBooksBalanceSnapshot,
  StripeBooksBalanceTransaction,
  StripeBooksPayoutRow,
  StripeBooksPeriod,
  StripeBooksReport,
  StripeBooksTopupRow,
} from "@/lib/types/stripeBooks"
import {
  aggregateStripeBooksTransactions,
  BUSINESS_TIMEZONE,
  categorizeStripeBalanceTransaction,
  coverageFromSnapshots,
  isoFromUnix,
  parseStripeBooksSearch,
  recentStripeBooksTransactions,
  resolveStripeBooksPeriod,
  STRIPE_BOOKS_TXN_PAGE_CAP,
  stripeBooksReportToCsv,
} from "@/lib/utils/stripeBooks"

const AUX_LIST_CAP = 2000

type StripeListPage<T> = {
  data: T[]
  has_more: boolean
}

async function listAllStripe<T extends { id: string }>(
  fetchPage: (startingAfter?: string) => Promise<StripeListPage<T>>,
  cap: number,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = []
  let startingAfter: string | undefined
  while (rows.length < cap) {
    const page = await fetchPage(startingAfter)
    rows.push(...page.data)
    if (!page.has_more) return { rows, truncated: false }
    const lastId = page.data[page.data.length - 1]?.id
    if (!lastId) break
    startingAfter = lastId
  }
  return { rows, truncated: true }
}

function createdFilter(period: StripeBooksPeriod): Stripe.RangeQueryParam | undefined {
  if (period.createdGte == null && period.createdLt == null) return undefined
  return {
    ...(period.createdGte != null ? { gte: period.createdGte } : {}),
    ...(period.createdLt != null ? { lt: period.createdLt } : {}),
  }
}

function usdBalanceCents(
  buckets: Array<{ amount: number; currency: string }> | null | undefined,
): number {
  if (!buckets) return 0
  return buckets.filter((row) => row.currency === "usd").reduce((sum, row) => sum + row.amount, 0)
}

function mapBalanceTransaction(bt: Stripe.BalanceTransaction): StripeBooksBalanceTransaction {
  const source = bt.source
  const sourceId =
    typeof source === "string" ? source : source && typeof source === "object" && "id" in source
      ? String(source.id)
      : null
  return {
    id: bt.id,
    created: bt.created,
    type: bt.type,
    reportingCategory: bt.reporting_category ?? null,
    description: bt.description ?? null,
    amount: bt.amount,
    fee: bt.fee,
    net: bt.net,
    currency: bt.currency,
    status: bt.status,
    feeDetails: (bt.fee_details ?? []).map((detail) => ({
      amount: detail.amount,
      type: detail.type,
      description: detail.description ?? null,
    })),
    sourceId,
  }
}

function mapPayout(payout: Stripe.Payout): StripeBooksPayoutRow {
  const destination =
    typeof payout.destination === "string"
      ? payout.destination
      : payout.destination && typeof payout.destination === "object" && "id" in payout.destination
        ? String(payout.destination.id)
        : null
  return {
    id: payout.id,
    createdIso: isoFromUnix(payout.created),
    arrivalIso: payout.arrival_date ? isoFromUnix(payout.arrival_date) : null,
    amountCents: payout.amount,
    status: payout.status,
    method: payout.method ?? null,
    destination,
  }
}

function mapTopup(topup: Stripe.Topup): StripeBooksTopupRow {
  return {
    id: topup.id,
    createdIso: isoFromUnix(topup.created),
    amountCents: topup.amount,
    status: topup.status,
  }
}

function snapshotFromStripeBalance(balance: Stripe.Balance): StripeBooksBalanceSnapshot {
  const availableCents = usdBalanceCents(balance.available)
  const pendingCents = usdBalanceCents(balance.pending)
  const connectReservedCents = usdBalanceCents(balance.connect_reserved)
  const instantAvailableCents = usdBalanceCents(balance.instant_available)
  return {
    availableCents,
    pendingCents,
    connectReservedCents,
    instantAvailableCents,
    totalCents: availableCents + pendingCents + connectReservedCents,
    currency: "usd",
  }
}

function platformAccountId(): string | null {
  return process.env.STRIPE_PLATFORM_ACCOUNT_ID?.trim() || null
}

export async function loadStripeBooksReport(
  rawQuery: { month?: string | string[]; range?: string | string[] } = {},
  options: { includeAllTransactions?: boolean } = {},
): Promise<
  | { ok: true; data: StripeBooksReport }
  | { ok: false; error: string; status: number }
> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return { ok: false, error: "Stripe is not configured on this server.", status: 503 }
  }

  const query = parseStripeBooksSearch(rawQuery)
  const period = resolveStripeBooksPeriod(query)
  const created = createdFilter(period)

  let stripe: Stripe
  try {
    stripe = getStripe()
  } catch (error) {
    console.error("[stripe books] getStripe", error)
    return { ok: false, error: "Stripe is not configured on this server.", status: 503 }
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch (error) {
    console.error("[stripe books] service role", error)
    return {
      ok: false,
      error: "Add SUPABASE_SERVICE_ROLE_KEY on the server to load wallet and order ledgers.",
      status: 500,
    }
  }

  try {
    const [balance, btPage, payoutPage, topupPage, ledger] = await Promise.all([
      stripe.balance.retrieve(),
      listAllStripe(
        (startingAfter) =>
          stripe.balanceTransactions.list({
            limit: 100,
            ...(created ? { created } : {}),
            ...(startingAfter ? { starting_after: startingAfter } : {}),
          }),
        STRIPE_BOOKS_TXN_PAGE_CAP,
      ),
      listAllStripe(
        (startingAfter) =>
          stripe.payouts.list({
            limit: 100,
            ...(created ? { created } : {}),
            ...(startingAfter ? { starting_after: startingAfter } : {}),
          }),
        AUX_LIST_CAP,
      ),
      listAllStripe(
        (startingAfter) =>
          stripe.topups.list({
            limit: 100,
            ...(created ? { created } : {}),
            ...(startingAfter ? { starting_after: startingAfter } : {}),
          }),
        AUX_LIST_CAP,
      ),
      loadStripeBooksLedgerSnapshot(supabase, period),
    ])

    const categorized = btPage.rows.map((bt) => categorizeStripeBalanceTransaction(mapBalanceTransaction(bt)))
    const aggregated = aggregateStripeBooksTransactions(categorized)
    const snapshot = snapshotFromStripeBalance(balance)
    const listedThroughIso = categorized[categorized.length - 1]?.createdIso ?? null

    const report: StripeBooksReport = {
      generatedAtIso: new Date().toISOString(),
      timezone: BUSINESS_TIMEZONE,
      period,
      livemode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ?? null,
      stripeAccountId: platformAccountId(),
      truncated: btPage.truncated,
      transactionCount: categorized.length,
      listedThroughIso,
      balance: snapshot,
      categories: aggregated.categories,
      months: aggregated.months,
      transactions: options.includeAllTransactions
        ? categorized
        : recentStripeBooksTransactions(categorized),
      payouts: payoutPage.rows.map(mapPayout),
      topups: topupPage.rows.map(mapTopup),
      ledger,
      coverage: coverageFromSnapshots(snapshot.availableCents, snapshot.pendingCents, ledger),
      stripeNetChangeCents: aggregated.stripeNetChangeCents,
      unexplainedOtherCents: aggregated.unexplainedOtherCents,
      feeTotals: {
        processingFeeCents: aggregated.processingFeeCents,
        connectFeeCents: aggregated.connectFeeCents,
        instantFeeCents: aggregated.instantFeeCents,
      },
    }

    return { ok: true, data: report }
  } catch (error) {
    console.error("[stripe books] load", error)
    return { ok: false, error: "Could not load Stripe books.", status: 502 }
  }
}

export async function loadStripeBooksCsv(
  rawQuery: { month?: string | string[]; range?: string | string[] } = {},
): Promise<
  | { ok: true; csv: string; filename: string }
  | { ok: false; error: string; status: number }
> {
  const loaded = await loadStripeBooksReport(rawQuery, { includeAllTransactions: true })
  if (!loaded.ok) return loaded
  const stamp = loaded.data.period.yearMonth ?? loaded.data.period.mode
  return {
    ok: true,
    csv: stripeBooksReportToCsv(loaded.data),
    filename: `reswell-stripe-books-${stamp}.csv`,
  }
}
