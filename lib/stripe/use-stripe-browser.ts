"use client"

import { useCallback, useEffect, useState } from "react"

import { ensurePostHogClient } from "@/lib/client/init-posthog-client"
import {
  getStripeBrowser,
  retryStripeJs,
  STRIPE_JS_LOAD_ERROR,
  type StripeBrowserPromise,
} from "@/lib/stripe/load-stripe-browser"

/**
 * Shared Stripe.js handle for every web checkout surface.
 *
 * The promise never rejects (retries, then resolves `null`) so prefetch and
 * `<Elements>` cannot leak `Failed to load Stripe.js` as an unhandled rejection.
 */
export function useStripeBrowser(): {
  stripePromise: StripeBrowserPromise
  unavailable: boolean
  retry: () => void
} {
  const [generation, setGeneration] = useState(0)
  const stripePromise = getStripeBrowser()
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    if (!stripePromise) {
      setUnavailable(false)
      return
    }

    let cancelled = false
    setUnavailable(false)

    void stripePromise.then(
      (stripe) => {
        if (cancelled) return
        const missed = stripe == null
        setUnavailable(missed)
        if (missed) {
          void ensurePostHogClient().then((posthog) => {
            posthog?.captureException(new Error(`${STRIPE_JS_LOAD_ERROR} after retries`))
          })
        }
      },
      () => {
        if (cancelled) return
        setUnavailable(true)
      },
    )

    return () => {
      cancelled = true
    }
  }, [stripePromise, generation])

  const retry = useCallback(() => {
    setUnavailable(false)
    retryStripeJs()
    setGeneration((current) => current + 1)
  }, [])

  return { stripePromise, unavailable, retry }
}
