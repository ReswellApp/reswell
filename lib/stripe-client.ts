import Stripe from "stripe"

function requireStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to your .env.local file."
    )
  }
  return key
}

const globalForStripe = globalThis as unknown as { stripeSingleton?: Stripe }

/**
 * Single Stripe client for all server requests. Lazily instantiated so `next build`
 * can run without the secret unless a route calls Stripe.
 */
function getStripeSingleton(): Stripe {
  if (!globalForStripe.stripeSingleton) {
    globalForStripe.stripeSingleton = new Stripe(requireStripeSecretKey())
  }
  return globalForStripe.stripeSingleton
}

export default getStripeSingleton

/** @returns null if the secret is missing (optional Stripe features). */
export function getStripeOptional(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) return null
  if (!globalForStripe.stripeSingleton) {
    globalForStripe.stripeSingleton = new Stripe(key)
  }
  return globalForStripe.stripeSingleton
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim())
}
