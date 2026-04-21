/**
 * Server-only: Klaviyo Events API — fires when a user cashes out from `/dashboard/earnings`
 * (Stripe Connect bank payout or PayPal payout).
 *
 * **Metric name in Klaviyo:** `Payouts` — create a flow triggered by this metric.
 *
 * **Building the flow in Klaviyo:** Flows → Create flow → Metric → select **Payouts** →
 * add email; in the template use event variables, e.g.
 *   `{{ event.method }}`            ("stripe_bank" | "paypal")
 *   `{{ event.method_label }}`      ("Bank (Stripe)" | "PayPal")
 *   `{{ event.speed }}`             ("standard" | "instant" | "paypal")
 *   `{{ event.amount_usd }}`        (gross requested cash-out)
 *   `{{ event.fee_usd }}`           (instant-payout fee; 0 for standard/PayPal)
 *   `{{ event.net_usd }}`           (what actually arrives at the destination)
 *   `{{ event.destination }}`       (PayPal email; empty for Stripe bank)
 *   `{{ event.transfer_id }}`       (Stripe transfer id, when applicable)
 *   `{{ event.payout_id }}`         (Stripe instant payout id or PayPal batch id, when applicable)
 *   `{{ event.earnings_url }}`      (link back to /dashboard/earnings)
 *   `{{ event.available_balance_after_usd }}`
 *
 * Profile on the event is the **seller cashing out** (`external_id` + email when available).
 */

import { publicSiteOrigin } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export type KlaviyoPayoutMethod = "stripe_bank" | "paypal"
export type KlaviyoPayoutSpeed = "standard" | "instant" | "paypal"

export type KlaviyoPayoutPayload = {
  userId: string
  userEmail: string | null
  method: KlaviyoPayoutMethod
  speed: KlaviyoPayoutSpeed
  /** Gross amount the user requested to cash out (USD). */
  amountUsd: number
  /** Fee withheld (instant Stripe payouts only; 0 otherwise). */
  feeUsd: number
  /** Amount that actually arrives at the destination (USD). */
  netUsd: number
  /** PayPal email/ID when method === "paypal"; empty for Stripe. */
  destination?: string | null
  /** Stripe transfer id (Stripe bank payouts). */
  stripeTransferId?: string | null
  /** Stripe instant payout id OR PayPal batch id. */
  payoutId?: string | null
  /** Wallet balance after the cash-out (USD). */
  availableBalanceAfterUsd?: number | null
  /**
   * Stable key for dedupe. Prefer the DB row id for the payout (stripe_connect_transfers.id
   * or paypal_payouts.id). Falls back to a method+payoutId combo.
   */
  uniqueId: string
}

function methodLabel(method: KlaviyoPayoutMethod): string {
  return method === "paypal" ? "PayPal" : "Bank (Stripe)"
}

export async function trackKlaviyoPayout(
  payload: KlaviyoPayoutPayload,
): Promise<void> {
  const amountUsdNum =
    typeof payload.amountUsd === "number" ? payload.amountUsd : Number(payload.amountUsd)
  const feeUsdNum =
    typeof payload.feeUsd === "number" ? payload.feeUsd : Number(payload.feeUsd)
  const netUsdNum =
    typeof payload.netUsd === "number" ? payload.netUsd : Number(payload.netUsd)
  const balanceAfterNum =
    typeof payload.availableBalanceAfterUsd === "number"
      ? payload.availableBalanceAfterUsd
      : Number(payload.availableBalanceAfterUsd)

  const origin = publicSiteOrigin()
  const earningsUrl = `${origin}/dashboard/earnings`

  await sendKlaviyoServerEvent({
    metricName: "Payouts",
    profile: {
      external_id: payload.userId,
      email: payload.userEmail,
    },
    uniqueId: payload.uniqueId,
    value: Number.isFinite(amountUsdNum) ? amountUsdNum : undefined,
    valueCurrency: "USD",
    properties: {
      method: payload.method,
      method_label: methodLabel(payload.method),
      speed: payload.speed,
      amount_usd: Number.isFinite(amountUsdNum) ? amountUsdNum : payload.amountUsd,
      fee_usd: Number.isFinite(feeUsdNum) ? feeUsdNum : payload.feeUsd,
      net_usd: Number.isFinite(netUsdNum) ? netUsdNum : payload.netUsd,
      destination: payload.destination ?? "",
      transfer_id: payload.stripeTransferId ?? "",
      payout_id: payload.payoutId ?? "",
      available_balance_after_usd: Number.isFinite(balanceAfterNum)
        ? balanceAfterNum
        : null,
      earnings_url: earningsUrl,
    },
  })
}
