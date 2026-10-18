import {
  mobileCashOutResultSchema,
  mobileEarningsSchema,
  mobilePayoutOnboardingSchema,
  type MobileCashOutResult,
  type MobileEarnings,
} from "@reswell/api-contract"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getMySellerEarningsTotals } from "@/lib/db/sellerEarningsTotals"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import { trackKlaviyoPayout } from "@/lib/klaviyo/track-payout"
import {
  cashOutToStripeConnectedAccount,
  createConnectHostedOnboardingLink,
  ensureExpressConnectedAccount,
  getStripeConnectStatusForUser,
} from "@/lib/services/stripeConnect"
import { STRIPE_INSTANT_BANK_PAYOUT_FEE_RATE } from "@/lib/utils/stripe-connect-cashout"
import type { StripeConnectStatusPayload } from "@/lib/utils/stripe-connect-status"

const ACTIVITY_LIMIT = 20

function usd(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 100) / 100
}

function money(amount: number): string {
  const sign = amount < 0 ? "-" : ""
  return `${sign}$${Math.abs(amount).toFixed(2)}`
}

function activityTitle(description: string, type: string): string {
  const cleaned = description
    .replace(/^Pending — /, "")
    .replace(/^Available — /, "")
    .trim()
  return cleaned || type
}

function activityStatus(type: string, description: string, status: string): string {
  if (type === "cashout") return "Payout"
  if (type === "refund") return "Refund"
  if (description.startsWith("Pending") || status === "pending") return "Pending"
  if (type === "sale") return "Ready"
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Activity"
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

  const [totals, activityResult, payoutStatus] = await Promise.all([
    getMySellerEarningsTotals(supabase),
    wallet
      ? supabase
          .from("wallet_transactions")
          .select("id, type, amount, description, status, created_at")
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

  const activity = (activityResult.data ?? [])
    .map((row) => {
      const amount = usd(row.amount)
      const description = typeof row.description === "string" ? row.description : ""
      const type = typeof row.type === "string" ? row.type : "activity"
      if (Math.abs(amount) < 0.005 && description.startsWith("Available —")) return null
      return {
        id: String(row.id),
        title: activityTitle(description, type),
        status_label: activityStatus(type, description, typeof row.status === "string" ? row.status : ""),
        amount_usd: amount,
        amount_label: money(type === "cashout" ? -Math.abs(amount) : amount),
        created_at: String(row.created_at ?? ""),
      }
    })
    .filter((row) => row != null)

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
    activity,
  })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load earnings right now" }
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
