/**
 * Persist the buyer's email on Stripe PaymentIntent metadata so the Conversions API
 * Purchase event (often fired from a Stripe webhook with no session) still has `em`.
 */

export const STRIPE_BUYER_EMAIL_METADATA_KEY = "buyer_email"

/** Stripe metadata values are capped at 500 characters. */
const STRIPE_METADATA_VALUE_MAX = 500

export function stripeBuyerEmailMetadata(
  email: string | null | undefined,
): Record<string, string> {
  const trimmed = email?.trim()
  if (!trimmed) return {}
  return {
    [STRIPE_BUYER_EMAIL_METADATA_KEY]: trimmed.slice(0, STRIPE_METADATA_VALUE_MAX),
  }
}

export function buyerEmailFromPaymentIntentMetadata(
  metadata: Record<string, string> | null | undefined,
): string | null {
  const raw = metadata?.[STRIPE_BUYER_EMAIL_METADATA_KEY]?.trim()
  return raw || null
}

/** First non-empty trimmed email among candidates (PaymentIntent → auth → shipping). */
export function firstNonEmptyEmail(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim()
    if (trimmed) return trimmed
  }
  return null
}
