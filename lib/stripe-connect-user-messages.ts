/**
 * Safe, user-facing copy for Stripe (Connect + payouts). Never include raw Stripe or DB errors in these strings.
 */
export const STRIPE_CONNECT_GENERIC_ERROR =
  "We're having trouble connecting to our payment provider. Please try again in a moment or contact Reswell support."

/** Shown when a payout API call to Stripe fails; details stay in server logs only. */
export const STRIPE_PAYOUT_GENERIC_ERROR = STRIPE_CONNECT_GENERIC_ERROR
