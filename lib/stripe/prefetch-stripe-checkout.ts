import { stripeCardCheckoutEnabled } from "@/lib/stripe/client-checkout-enabled"

let prefetchPromise: Promise<void> | null = null

/**
 * Warm the Stripe checkout code-split chunk + Stripe.js CDN while the buyer fills in
 * purchase details, so mounting the payment form is usually instant.
 */
export function prefetchStripeCheckout(options?: { immediate?: boolean }): Promise<void> {
  if (typeof window === "undefined" || !stripeCardCheckoutEnabled()) {
    return Promise.resolve()
  }

  if (!prefetchPromise) {
    const run = () =>
      Promise.all([
        import("@/lib/stripe/load-stripe-browser").then((mod) => {
          mod.prefetchStripeJs()
        }),
        import("@/components/stripe-card-checkout"),
      ]).then(() => undefined)

    prefetchPromise = options?.immediate
      ? run()
      : new Promise<void>((resolve, reject) => {
          const start = () => {
            run().then(resolve).catch(reject)
          }

          if ("requestIdleCallback" in window) {
            window.requestIdleCallback(() => start(), { timeout: 2_000 })
          } else {
            setTimeout(start, 0)
          }
        })
  }

  return prefetchPromise
}
