/** Stripe metadata flag for buyer-offer authorizations (manual capture). */
export const OFFER_BINDING_METADATA_KEY = "offer_binding"
export const OFFER_BINDING_METADATA_VALUE = "1"

export const OFFER_AUTHORIZATION_MIN_CENTS = 50
export const OFFER_BINDING_ORPHAN_AFTER_MS = 60 * 60 * 1000

export function isBindingOfferPaymentIntent(
  metadata: Record<string, string | undefined> | null | undefined,
): boolean {
  return metadata?.[OFFER_BINDING_METADATA_KEY] === OFFER_BINDING_METADATA_VALUE
}

export function offerAuthorizationAmountMatches(
  authorizedCents: number,
  expectedCents: number,
): boolean {
  return (
    Number.isInteger(authorizedCents) &&
    Number.isInteger(expectedCents) &&
    authorizedCents === expectedCents &&
    authorizedCents >= OFFER_AUTHORIZATION_MIN_CENTS
  )
}

export function canCaptureOfferAuthorization(status: string): boolean {
  return status === "requires_capture"
}

export function isOfferAuthorizationCaptured(status: string): boolean {
  return status === "succeeded"
}

/** Statuses we may cancel without charging the buyer. Never cancel `succeeded`. */
export function canReleaseOfferAuthorization(status: string): boolean {
  return (
    status === "requires_payment_method" ||
    status === "requires_confirmation" ||
    status === "requires_action" ||
    status === "requires_capture"
  )
}

export function shouldCleanupOrphanOfferBinding(params: {
  offerBinding: boolean
  offerId: string | null | undefined
  createdAtMs: number
  referenceTimeMs: number
  orphanAfterMs?: number
}): boolean {
  if (!params.offerBinding) return false
  if (params.offerId?.trim()) return false
  const orphanAfterMs = params.orphanAfterMs ?? OFFER_BINDING_ORPHAN_AFTER_MS
  return params.referenceTimeMs - params.createdAtMs >= orphanAfterMs
}

export function offerIsBinding(offer: { payment_intent_id?: string | null }): boolean {
  return Boolean(offer.payment_intent_id?.trim())
}
