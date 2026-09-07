import { stripeCardCheckoutEnabled } from "@/lib/stripe/client-checkout-enabled"

let prefetchPromise: Promise<void> | null = null

/** Warm the mark-as-sold tip checkout chunk and Stripe.js before a tip is chosen. */
export function prefetchSaleTipCheckout(): Promise<void> {
  if (typeof window === "undefined" || !stripeCardCheckoutEnabled()) {
    return Promise.resolve()
  }

  prefetchPromise ??= import("@/components/features/listings/mark-sold-tip-checkout").then(
    (mod) => {
      mod.prefetchSaleTipStripeJs()
    },
  )

  return prefetchPromise
}
