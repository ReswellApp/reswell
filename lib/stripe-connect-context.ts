import type Stripe from "stripe"

/**
 * Stripe-Context for V2 **read** operations on a connected account (`accounts.retrieve`, `accounts.close`).
 * Do **not** use this for `v2.core.accountLinks.create` — that call uses the platform key and passes
 * `account` in the body; adding context there often triggers "key does not have access to account".
 *
 * @see https://docs.stripe.com/context
 */
export function stripeContextForConnectedAccount(
  connectedAccountId: string
): Stripe.RequestOptions {
  const platformId = process.env.STRIPE_PLATFORM_ACCOUNT_ID?.trim()
  const stripeContext = platformId
    ? `${platformId}/${connectedAccountId}`
    : connectedAccountId

  return { stripeContext }
}

export function isStripeConnectAccountAccessError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes("does not have access to account") ||
    m.includes("application access may have been revoked") ||
    m.includes("no such account")
  )
}
