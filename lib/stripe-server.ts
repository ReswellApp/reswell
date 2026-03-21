import Stripe from "stripe"

/** True when Stripe Checkout can be used (server-side secret key set). */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim())
}

/** Stripe client for server routes. Returns null if STRIPE_SECRET_KEY is missing. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) return null
  return new Stripe(key)
}
