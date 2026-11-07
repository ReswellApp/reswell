/**
 * Client helpers for checkout PaymentIntents that Stripe.js reported as failed
 * after the charge actually succeeded. Buyers were retrying and getting billed again.
 */

export function paymentIntentIdFromClientSecret(clientSecret: string): string | null {
  const trimmed = clientSecret.trim()
  const idx = trimmed.indexOf("_secret_")
  if (idx <= 0) return null
  const id = trimmed.slice(0, idx)
  return id.startsWith("pi_") ? id : null
}

export function stripePaymentIntentLooksPaid(status: string | null | undefined): boolean {
  return status === "succeeded" || status === "processing"
}

export function paymentIntentFromStripeConfirmError(error: unknown): {
  id: string | null
  status: string | null
} {
  if (error == null || typeof error !== "object") {
    return { id: null, status: null }
  }
  const pi = (error as { payment_intent?: unknown }).payment_intent
  if (pi == null || typeof pi !== "object") {
    return { id: null, status: null }
  }
  const record = pi as { id?: unknown; status?: unknown }
  const id = typeof record.id === "string" && record.id.startsWith("pi_") ? record.id : null
  const status = typeof record.status === "string" ? record.status : null
  return { id, status }
}

export function stripeConfirmErrorLooksAlreadySucceeded(error: unknown): boolean {
  if (error == null || typeof error !== "object") return false
  const record = error as { code?: unknown; decline_code?: unknown; message?: unknown }
  const code = typeof record.code === "string" ? record.code : ""
  const message = typeof record.message === "string" ? record.message.toLowerCase() : ""
  if (code === "payment_intent_unexpected_state") return true
  return (
    message.includes("already succeeded") ||
    message.includes("status of succeeded") ||
    message.includes("has already been confirmed")
  )
}

export function paidPaymentIntentIdFromConfirmResult(input: {
  paymentIntent?: { id?: string | null; status?: string | null } | null
  error?: unknown
  clientSecret?: string | null
}): string | null {
  const fromResult = input.paymentIntent
  if (
    fromResult?.id &&
    stripePaymentIntentLooksPaid(fromResult.status)
  ) {
    return fromResult.id
  }

  const fromError = paymentIntentFromStripeConfirmError(input.error)
  if (fromError.id && stripePaymentIntentLooksPaid(fromError.status)) {
    return fromError.id
  }

  if (stripeConfirmErrorLooksAlreadySucceeded(input.error) && input.clientSecret) {
    return paymentIntentIdFromClientSecret(input.clientSecret)
  }

  return null
}

export const ALREADY_PURCHASED_CHECKOUT_CODE = "already_purchased"
