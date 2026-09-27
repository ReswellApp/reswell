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

export const OFFER_CARD_DECLINED_ERROR =
  "The buyer’s card was declined, so this offer was not accepted. Decline it so they can send a new offer with a different card."

export const OFFER_CARD_NOT_CHARGED_ERROR =
  "The buyer’s card was not charged, so this offer was not accepted. Ask them to send a new offer."

const DECLINED_CHARGE_OUTCOMES = new Set(["issuer_declined", "blocked"])

export type OfferCapturedChargeSnapshot = {
  status: string
  paid: boolean
  captured: boolean
  amountCaptured: number
  failureCode?: string | null
  outcomeType?: string | null
}

/** Fields needed to decide whether an offer capture actually took the card. */
export type OfferChargeSnapshot = {
  status: string
  amount: number
  amountReceived: number
  lastPaymentErrorCode?: string | null
  lastPaymentErrorDeclineCode?: string | null
  /** Null when `latest_charge` was not expanded. That is not proof of payment. */
  charge: OfferCapturedChargeSnapshot | null
}

type PaymentIntentChargeFields = {
  status: string
  amount: number
  amount_received?: number | null
  last_payment_error?: { code?: string | null; decline_code?: string | null } | null
  latest_charge?:
    | string
    | {
        status?: string | null
        paid?: boolean | null
        captured?: boolean | null
        amount_captured?: number | null
        failure_code?: string | null
        outcome?: { type?: string | null } | null
      }
    | null
}

export function offerChargeSnapshotFromPaymentIntent(
  paymentIntent: PaymentIntentChargeFields,
): OfferChargeSnapshot {
  const latest = paymentIntent.latest_charge
  const charge =
    latest && typeof latest === "object"
      ? {
          status: latest.status ?? "",
          paid: latest.paid === true,
          captured: latest.captured === true,
          amountCaptured: latest.amount_captured ?? 0,
          failureCode: latest.failure_code ?? null,
          outcomeType: latest.outcome?.type ?? null,
        }
      : null

  return {
    status: paymentIntent.status,
    amount: paymentIntent.amount,
    amountReceived: paymentIntent.amount_received ?? 0,
    lastPaymentErrorCode: paymentIntent.last_payment_error?.code ?? null,
    lastPaymentErrorDeclineCode: paymentIntent.last_payment_error?.decline_code ?? null,
    charge,
  }
}

function chargeWasDeclined(snapshot: OfferChargeSnapshot): boolean {
  const charge = snapshot.charge
  if (charge?.status === "failed") return true
  if (charge?.failureCode) return true
  if (charge?.outcomeType != null && DECLINED_CHARGE_OUTCOMES.has(charge.outcomeType)) return true
  if (charge?.status === "succeeded" && charge.paid && charge.captured) return false
  if (snapshot.lastPaymentErrorDeclineCode) return true
  if (snapshot.lastPaymentErrorCode === "card_declined") return true
  return false
}

/**
 * Null when the card was fully captured. A PaymentIntent status of `succeeded`
 * is not enough: the latest charge must be paid, captured, and not declined.
 */
export function offerChargeDeclineReason(snapshot: OfferChargeSnapshot): string | null {
  const charge = snapshot.charge
  const fullyCaptured =
    snapshot.status === "succeeded" &&
    Number.isInteger(snapshot.amount) &&
    snapshot.amount >= OFFER_AUTHORIZATION_MIN_CENTS &&
    snapshot.amountReceived >= snapshot.amount &&
    charge != null &&
    charge.status === "succeeded" &&
    charge.paid &&
    charge.captured &&
    charge.amountCaptured >= snapshot.amount &&
    !charge.failureCode &&
    (charge.outcomeType == null || !DECLINED_CHARGE_OUTCOMES.has(charge.outcomeType))

  if (fullyCaptured) return null
  if (chargeWasDeclined(snapshot)) return OFFER_CARD_DECLINED_ERROR
  return OFFER_CARD_NOT_CHARGED_ERROR
}

function stripeErrorCode(value: unknown): string | null {
  if (!value || typeof value !== "object") return null
  const code = (value as { code?: unknown }).code
  return typeof code === "string" && code.trim() ? code : null
}

function stripeDeclineCode(value: unknown): string | null {
  if (!value || typeof value !== "object") return null
  const code = (value as { decline_code?: unknown }).decline_code
  return typeof code === "string" && code.trim() ? code : null
}

/** Map a thrown Stripe capture/confirm error to the buyer-decline message. */
export function offerDeclineMessageFromStripeError(error: unknown): string | null {
  if (!error || typeof error !== "object") return null
  const record = error as {
    code?: unknown
    decline_code?: unknown
    raw?: unknown
    payment_intent?: { last_payment_error?: unknown } | null
  }
  const lastError = record.payment_intent?.last_payment_error
  const declined = Boolean(
    stripeDeclineCode(record) ||
      stripeDeclineCode(record.raw) ||
      stripeDeclineCode(lastError) ||
      stripeErrorCode(record) === "card_declined" ||
      stripeErrorCode(record.raw) === "card_declined" ||
      stripeErrorCode(lastError) === "card_declined",
  )
  return declined ? OFFER_CARD_DECLINED_ERROR : null
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
