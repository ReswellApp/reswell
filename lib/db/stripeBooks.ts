import type { SupabaseClient } from "@supabase/supabase-js"
import { summarizeStoredWalletBalanceRow } from "@/lib/getSellerBalance"
import { listSucceededSellerSaleTipRevenues } from "@/lib/db/sellerSaleTips"
import {
  emptyLedgerSnapshot,
  isStripeCardPaymentMethod,
  usdToCents,
} from "@/lib/utils/stripeBooks"
import type { StripeBooksLedgerSnapshot, StripeBooksPeriod } from "@/lib/types/stripeBooks"

const PAGE_SIZE = 1000

type OrderRow = {
  amount: number | string | null
  shipping_amount: number | string | null
  platform_fee: number | string | null
  seller_earnings: number | string | null
  promo_discount_usd: number | string | null
  payment_method: string | null
  refunded_at: string | null
  created_at: string
}

type TransferRow = {
  amount: number | string | null
  fee_amount: number | string | null
  payout_speed: string | null
  status: string | null
  created_at: string
}

type WalletRow = {
  id: string
  balance: string | number | null
  pending_balance: string | number | null
  lifetime_earned: string | number | null
  lifetime_spent: string | number | null
  lifetime_cashed_out: string | number | null
}

function inPeriod(createdAt: string, period: StripeBooksPeriod): boolean {
  if (period.startIso && createdAt < period.startIso) return false
  if (period.endIsoExclusive && createdAt >= period.endIsoExclusive) return false
  return true
}

async function listAllRows<T>(
  loadPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await loadPage(from, from + PAGE_SIZE - 1)
    if (error) {
      console.error(`[stripe books db] ${label}`, error.message)
      throw new Error(`Could not load ${label}`)
    }
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

export async function loadStripeBooksLedgerSnapshot(
  supabase: SupabaseClient,
  period: StripeBooksPeriod,
): Promise<StripeBooksLedgerSnapshot> {
  const ledger = emptyLedgerSnapshot()

  const [orders, transfers, wallets, tips] = await Promise.all([
    listAllRows<OrderRow>(
      (from, to) => {
        let query = supabase
          .from("orders")
          .select(
            "amount, shipping_amount, platform_fee, seller_earnings, promo_discount_usd, payment_method, refunded_at, created_at",
          )
          .eq("status", "confirmed")
          .eq("is_admin_test", false)
          .order("created_at", { ascending: true })
          .range(from, to)
        if (period.startIso) query = query.gte("created_at", period.startIso)
        if (period.endIsoExclusive) query = query.lt("created_at", period.endIsoExclusive)
        return query
      },
      "orders",
    ),
    listAllRows<TransferRow>(
      (from, to) => {
        let query = supabase
          .from("stripe_connect_transfers")
          .select("amount, fee_amount, payout_speed, status, created_at")
          .eq("status", "SUCCEEDED")
          .order("created_at", { ascending: true })
          .range(from, to)
        if (period.startIso) query = query.gte("created_at", period.startIso)
        if (period.endIsoExclusive) query = query.lt("created_at", period.endIsoExclusive)
        return query
      },
      "connect transfers",
    ),
    listAllRows<WalletRow>(
      (from, to) =>
        supabase
          .from("wallets")
          .select("id, balance, pending_balance, lifetime_earned, lifetime_spent, lifetime_cashed_out")
          .order("id", { ascending: true })
          .range(from, to),
      "wallets",
    ),
    listSucceededSellerSaleTipRevenues(supabase),
  ])

  for (const order of orders) {
    ledger.confirmedOrderCount += 1
    const amount = usdToCents(order.amount)
    const shipping = usdToCents(order.shipping_amount)
    ledger.marketplaceFeeCents += usdToCents(order.platform_fee)
    ledger.sellerEarningsCents += usdToCents(order.seller_earnings)
    ledger.shippingCollectedCents += shipping
    ledger.promoMarketingCents += usdToCents(order.promo_discount_usd)
    if (isStripeCardPaymentMethod(order.payment_method)) {
      ledger.stripeOrderCount += 1
      ledger.cardOrderVolumeCents += amount
    }
    if (order.refunded_at) ledger.refundedOrderCount += 1
  }

  for (const transfer of transfers) {
    const gross = usdToCents(transfer.amount)
    const fee = usdToCents(transfer.fee_amount)
    ledger.connectTransferCount += 1
    ledger.connectTransferGrossCents += gross
    ledger.connectTransferFeeCents += fee
    ledger.connectTransferNetCents += gross - fee
    if (transfer.payout_speed === "instant") ledger.instantCashoutCount += 1
  }

  for (const wallet of wallets) {
    const summary = summarizeStoredWalletBalanceRow(wallet)
    ledger.walletAvailableCents += usdToCents(summary.balance)
    ledger.walletPendingCents += usdToCents(summary.pendingBalance)
    ledger.walletOwedCents += usdToCents(summary.inWalletOwed)
    ledger.walletLifetimeEarnedCents += usdToCents(summary.lifetime_earned)
    ledger.walletLifetimeCashedOutCents += usdToCents(summary.lifetime_cashed_out)
  }

  for (const tip of tips) {
    if (!inPeriod(tip.succeededAt, period)) continue
    ledger.tipRevenueCents += usdToCents(tip.amountUsd)
  }

  return ledger
}
