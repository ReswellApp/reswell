import type Stripe from "stripe"

/**
 * Request options so V2 Connect API calls run in the connected account's context.
 * Without this, production can return: "Permission denied ... supply Account ID in the Stripe-Context header".
 *
 * @see https://docs.stripe.com/context
 *
 * Standard platform secret key: use the connected account id alone (`acct_xxx`).
 * If your secret key belongs to a parent org (not the platform), set
 * `STRIPE_PLATFORM_ACCOUNT_ID` to your platform account id so context becomes
 * `platform_acct/connected_acct`.
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
