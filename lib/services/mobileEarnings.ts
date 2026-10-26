import {
  mobileCashOutResultSchema,
  mobileEarningsSchema,
  mobilePayoutOnboardingSchema,
  type MobileCashOutResult,
  type MobileEarnings,
} from "@reswell/api-contract"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { EarningsTransaction } from "@/components/features/earnings/earnings-types"
import { parseDescription } from "@/components/features/earnings/earnings-activity-helpers"
import type { EarningsBalanceListingRow } from "@/lib/earnings-balance-listings"
import { orderIdFromSellerSaleLedger } from "@/lib/earnings-sale-ledger"
import { getMySellerEarningsTotals } from "@/lib/db/sellerEarningsTotals"
import { absolutePublicMediaUrl } from "@/lib/site-metadata"
import { attachListingsToEarningsTransactions } from "@/lib/services/earningsActivityListings"
import { getEarningsBalanceListings } from "@/lib/services/earningsBalanceListings"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import { trackKlaviyoPayout } from "@/lib/klaviyo/track-payout"
import {
  cashOutToStripeConnectedAccount,
  createConnectExpressLoginLink,
  createConnectHostedOnboardingLink,
  ensureExpressConnectedAccount,
  getStripeConnectStatusForUser,
} from "@/lib/services/stripeConnect"
import { STRIPE_INSTANT_BANK_PAYOUT_FEE_RATE } from "@/lib/utils/stripe-connect-cashout"
import type { StripeConnectStatusPayload } from "@/lib/utils/stripe-connect-status"

const ACTIVITY_LIMIT = 40

type ActivityKind = MobileEarnings["activity"][number]["kind"]

function txType(value: string): EarningsTransaction["type"] {
  if (value === "sale" || value === "purchase" || value === "cashout" || value === "deposit" || value === "refund") {
    return value
  }
  return "sale"
}

function activityKind(tx: EarningsTransaction): ActivityKind {
  if (tx.type === "cashout") return "payout"
  if (tx.type === "refund" || tx.description.startsWith("Refund")) return "refund"
  if (tx.description.startsWith("Pending —") || tx.reference_type === "order_pending_earnings") return "pending"
  if (
    tx.description.startsWith("Available —") ||
    tx.reference_type === "order_seller_earnings" ||
    tx.type === "sale"
  ) {
    return "ready"
  }
  return "other"
}

function statusLabel(kind: ActivityKind): string {
  if (kind === "pending") return "Pending"
  if (kind === "ready") return "Ready"
  if (kind === "payout") return "Payout"
  if (kind === "refund") return "Refund"
  return "Activity"
}

function displayTitle(tx: EarningsTransaction): string {
  if (tx.listing?.title) return tx.listing.title
  const title = parseDescription(tx.description, tx.type).title
  const cleaned = title.replace(/^(Pending|Available|Sold|Refund|Payout|Purchased) — /, "").trim()
  return cleaned || "Activity"
}

function uuidOrNull(value: string | null | undefined): string | null {
  if (!value) return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null
}

function saleIdFromHref(href: string | null): string | null {
  const match = href?.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)
  return uuidOrNull(match?.[1])
}

function mediaUrl(src: string | null | undefined): string | null {
  return absolutePublicMediaUrl(src) ?? null
}

function ledgerLine(tx: EarningsTransaction): MobileEarnings["activity"][number] | null {
  const amount = usd(tx.amount)
  if (Math.abs(amount) < 0.005 && tx.description.startsWith("Available —")) return null
  const kind = activityKind(tx)
  const signed = kind === "payout" ? -Math.abs(amount) : amount
  const saleId = uuidOrNull(orderIdFromSellerSaleLedger(tx))
  return {
    id: tx.id,
    title: displayTitle(tx),
    status_label: statusLabel(kind),
    kind,
    amount_usd: signed,
    amount_label: money(signed),
    created_at: tx.created_at,
    image_url: mediaUrl(tx.listing?.imageUrl),
    sale_id: saleId,
  }
}

function balanceLine(row: EarningsBalanceListingRow, kind: "pending" | "ready"): MobileEarnings["activity"][number] {
  return {
    id: row.key,
    title: row.title,
    status_label: kind === "pending" ? "Pending" : "Ready",
    kind,
    amount_usd: row.amountUsd,
    amount_label: money(row.amountUsd),
    created_at: row.createdAt,
    image_url: mediaUrl(row.imageUrl),
    sale_id: saleIdFromHref(row.saleHref),
  }
}

function asEarningsTx(row: {
  id: string
  type: string | null
  amount: number | string | null
  description: string | null
  status: string | null
  created_at: string | null
  reference_id: string | null
  reference_type: string | null
}): EarningsTransaction {
  return {
    id: row.id,
    type: txType(row.type ?? ""),
    amount: String(row.amount ?? "0"),
    balance_after: "0",
    description: row.description ?? "",
    status: row.status ?? "",
    created_at: row.created_at ?? "",
    reference_id: row.reference_id,
    reference_type: row.reference_type,
  }
}

function usd(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 100) / 100
}

function money(amount: number): string {
  const sign = amount < 0 ? "-" : ""
  return `${sign}$${Math.abs(amount).toFixed(2)}`
}

function payoutCopy(status: StripeConnectStatusPayload): { label: string; detail: string } {
  if (status.cashOutReady && status.bankLast4) {
    const bank = status.bankName ?? "Bank"
    return { label: "Bank connected", detail: `${bank} ···· ${status.bankLast4}. Cash out sends your ready balance to this bank.` }
  }
  if (status.setupStatus === "pending_review") {
    return { label: "Stripe is reviewing", detail: "Your payout details are in review. You can cash out after Stripe enables payouts." }
  }
  if (status.hasAccount) {
    return {
      label: "Finish payout setup",
      detail: status.verificationMessage ?? "Stripe still needs details before this account can receive a bank payout.",
    }
  }
  return {
    label: "No bank connected",
    detail: "Payouts use Stripe Connect. The app does not embed Stripe’s onboarding form.",
  }
}

export async function getMobileEarningsService(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileApiResult<MobileEarnings>> {
  const walletResult = await supabase
    .from("wallets")
    .select("id, balance, pending_balance, lifetime_cashed_out")
    .eq("user_id", userId)
    .maybeSingle()

  if (walletResult.error) {
    console.error("[mobile-api] earnings wallet failed", { timestamp: new Date().toISOString(), message: walletResult.error.message })
    return { ok: false, status: 500, error: "Unable to load earnings right now" }
  }

  const wallet = walletResult.data
  const ready = usd(wallet?.balance)
  const pending = Math.max(0, usd(wallet?.pending_balance))
  const available = Math.round((ready + pending) * 100) / 100
  const cashedOut = Math.max(0, usd(wallet?.lifetime_cashed_out))

  const [totals, activityResult, payoutStatus, balanceListings] = await Promise.all([
    getMySellerEarningsTotals(supabase),
    wallet
      ? supabase
          .from("wallet_transactions")
          .select("id, type, amount, description, status, created_at, reference_id, reference_type")
          .eq("wallet_id", wallet.id)
          .order("created_at", { ascending: false })
          .limit(ACTIVITY_LIMIT)
      : Promise.resolve({ data: [], error: null }),
    getStripeConnectStatusForUser(supabase, userId).catch((error: unknown) => {
      console.error("[mobile-api] earnings payout status failed", {
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
      })
      return null
    }),
    wallet
      ? getEarningsBalanceListings(supabase, {
          walletId: wallet.id,
          sellerId: userId,
          readyBalanceUsd: ready,
        })
      : Promise.resolve({ pending: [], ready: [], reversedOrderIds: [] }),
  ])
  const payout = payoutStatus
    ? payoutCopy(payoutStatus)
    : { label: "Payout status unavailable", detail: "Your balance is still up to date." }
  const banks = (payoutStatus?.bankAccounts ?? [])
    .filter((bank) => bank.id.trim().startsWith("ba_"))
    .map((bank) => ({
      id: bank.id,
      label: `${bank.bankName ?? "Bank"} ···· ${bank.last4 ?? "••••"}`,
      default: bank.defaultForCurrency,
    }))

  if (activityResult.error) {
    console.error("[mobile-api] earnings activity failed", { timestamp: new Date().toISOString(), message: activityResult.error.message })
    return { ok: false, status: 500, error: "Unable to load earnings right now" }
  }

  const rawActivity = (activityResult.data ?? []).map((row) =>
    asEarningsTx({
      id: String(row.id),
      type: typeof row.type === "string" ? row.type : null,
      amount: row.amount,
      description: typeof row.description === "string" ? row.description : null,
      status: typeof row.status === "string" ? row.status : null,
      created_at: typeof row.created_at === "string" ? row.created_at : null,
      reference_id: typeof row.reference_id === "string" ? row.reference_id : null,
      reference_type: typeof row.reference_type === "string" ? row.reference_type : null,
    }),
  )
  const withListings = await attachListingsToEarningsTransactions(supabase, rawActivity)
  const activity = withListings.map(ledgerLine).filter((row) => row != null && uuidOrNull(row.id))
  const pendingItems = balanceListings.pending.filter((row) => uuidOrNull(row.key)).map((row) => balanceLine(row, "pending"))
  const readyItems = balanceListings.ready.filter((row) => uuidOrNull(row.key)).map((row) => balanceLine(row, "ready"))

  const earnedLast30 = Math.max(0, totals?.earnedLast30dUsd ?? 0)
  const parsed = mobileEarningsSchema.safeParse({
    available_usd: available,
    available_label: money(available),
    ready_usd: Math.max(0, ready),
    ready_label: money(Math.max(0, ready)),
    pending_usd: pending,
    pending_label: money(pending),
    cashed_out_usd: cashedOut,
    cashed_out_label: money(cashedOut),
    earned_last_30d_usd: earnedLast30,
    earned_last_30d_label: money(earnedLast30),
    payout_label: payout.label,
    payout_detail: payout.detail,
    cash_out_ready: Boolean(payoutStatus?.cashOutReady),
    minimum_usd: 10,
    instant_fee_rate: STRIPE_INSTANT_BANK_PAYOUT_FEE_RATE,
    banks,
    pending_items: pendingItems,
    ready_items: readyItems,
    activity,
  })
  if (!parsed.success) {
    console.error("[mobile-api] earnings payload invalid", { timestamp: new Date().toISOString(), issues: parsed.error.flatten() })
    return { ok: false, status: 500, error: "Unable to load earnings right now" }
  }
  return { ok: true, data: parsed.data }
}

export async function createMobilePayoutOnboardingService(
  supabase: SupabaseClient,
  userId: string,
  email: string | null,
): Promise<MobileApiResult<{ url: string }>> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return { ok: false, status: 503, error: "Stripe payouts are not configured" }
  }
  const ensured = await ensureExpressConnectedAccount(supabase, userId, email)
  if ("error" in ensured) return { ok: false, status: 400, error: ensured.error }
  const link = await createConnectHostedOnboardingLink(ensured.stripeAccountId)
  if ("error" in link) return { ok: false, status: 502, error: link.error }
  const parsed = mobilePayoutOnboardingSchema.safeParse(link)
  if (!parsed.success) return { ok: false, status: 502, error: "Could not open Stripe verification. Try again shortly." }
  return { ok: true, data: parsed.data }
}

/** Stripe-hosted bank setup. First connection uses onboarding; a connected account opens the Express dashboard to add a bank. */
export async function createMobileAddBankService(
  supabase: SupabaseClient,
  userId: string,
  email: string | null,
): Promise<MobileApiResult<{ url: string }>> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return { ok: false, status: 503, error: "Stripe payouts are not configured" }
  }
  const ensured = await ensureExpressConnectedAccount(supabase, userId, email)
  if ("error" in ensured) return { ok: false, status: 400, error: ensured.error }

  const status = await getStripeConnectStatusForUser(supabase, userId).catch(() => null)
  const link = status?.cashOutReady
    ? await createConnectExpressLoginLink(ensured.stripeAccountId)
    : await createConnectHostedOnboardingLink(ensured.stripeAccountId)
  if ("error" in link && status?.cashOutReady) {
    const fallback = await createConnectHostedOnboardingLink(ensured.stripeAccountId)
    if ("error" in fallback) return { ok: false, status: 502, error: link.error }
    const parsedFallback = mobilePayoutOnboardingSchema.safeParse(fallback)
    if (!parsedFallback.success) return { ok: false, status: 502, error: "Could not open bank setup. Try again shortly." }
    return { ok: true, data: parsedFallback.data }
  }
  if ("error" in link) return { ok: false, status: 502, error: link.error }
  const parsed = mobilePayoutOnboardingSchema.safeParse(link)
  if (!parsed.success) return { ok: false, status: 502, error: "Could not open bank setup. Try again shortly." }
  return { ok: true, data: parsed.data }
}

export async function cashOutMobileEarningsService(
  supabase: SupabaseClient,
  user: { id: string; email: string | null },
  input: { amount: number; speed: "standard" | "instant"; externalAccountId?: string },
): Promise<MobileApiResult<MobileCashOutResult>> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return { ok: false, status: 503, error: "Stripe payouts are not configured" }
  }
  const result = await cashOutToStripeConnectedAccount(
    supabase,
    user.id,
    input.amount,
    input.speed,
    input.externalAccountId,
  )
  if (!result.ok) {
    const detail = result.errorDetail?.trim()
    return { ok: false, status: result.status ?? 400, error: detail ? `${result.error} ${detail}` : result.error }
  }

  void trackKlaviyoPayout({
    userId: user.id,
    userEmail: user.email,
    method: "stripe_bank",
    speed: result.speed,
    amountUsd: result.amountUsd,
    feeUsd: result.feeUsd,
    netUsd: result.netToBankUsd,
    destination: null,
    stripeTransferId: result.transferId,
    payoutId: result.stripePayoutId,
    availableBalanceAfterUsd: result.availableBalanceAfter,
    uniqueId: `payout-stripe-${result.transferId}`,
  })

  const parsed = mobileCashOutResultSchema.safeParse({
    message: result.message,
    amount_label: money(result.amountUsd),
    available_label: money(result.availableBalanceAfter),
  })
  if (!parsed.success) return { ok: false, status: 500, error: "Payout was sent, but the updated balance could not be shown." }
  return { ok: true, data: parsed.data }
}
