import { stripeCardCheckoutEnabled } from "@/lib/stripe/client-checkout-enabled"

let prefetchPromise: Promise<void> | null = null

/** Warm the mark-as-sold tip checkout chunk and Stripe.js before a tip is chosen. */
export function prefetchSaleTipCheckout(): Promise<void> {
  if (typeof window === "undefined" || !stripeCardCheckoutEnabled()) {
    return Promise.resolve()
  }

  prefetchPromise ??= Promise.all([
    import("@/lib/stripe/load-stripe-browser").then((mod) => {
      mod.prefetchStripeJs()
    }),
    import("@/components/features/listings/mark-sold-tip-checkout"),
  ]).then(() => undefined)

  return prefetchPromise
}
