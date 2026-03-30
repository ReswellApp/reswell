import type Stripe from "stripe"

/**
 * Stripe-Context for V2 Connect calls that target a connected account (`acct_…`).
 *
 * - If `STRIPE_SECRET_KEY` belongs to the **Connect platform** account: use the connected id only
 *   (`stripeContext` = `acct_xxx`). This is the default when `STRIPE_PLATFORM_ACCOUNT_ID` is unset.
 * - If the key belongs to a **parent organization** (not the platform): set `STRIPE_PLATFORM_ACCOUNT_ID`
 *   to the platform’s `acct_` id so context becomes `platform_acct/connected_acct`. Otherwise Stripe returns
 *   "Permission denied … supply an Account ID in the Stripe-Context header".
 *
 * Use for: `v2.core.accounts.retrieve`, `v2.core.accounts.close`, `v2.core.accountLinks.create` (body still
 * includes `account`; the header scopes the request).
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

/** "Permission denied" + Stripe-Context hint — org key without platform id, or restricted key. */
export function isStripeContextPermissionDenied(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes("permission denied") &&
    (m.includes("stripe-context") || m.includes("stripe-context header"))
  )
}
