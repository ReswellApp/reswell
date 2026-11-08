import type { Stripe } from "@stripe/stripe-js"

import { stripePublishableKey } from "@/lib/stripe/client-checkout-enabled"

/**
 * `@stripe/stripe-js` rejects with this when the js.stripe.com script never
 * registers `window.Stripe` — ad blockers, flaky mobile radio, or a dropped
 * CDN request. Checkout was caching that rejected promise (`??= loadStripe()`),
 * so one failure blocked payment for the rest of the session.
 */
export const STRIPE_JS_LOAD_ERROR = "Failed to load Stripe.js"

export const STRIPE_JS_LOAD_ATTEMPTS = 3

/** Delay before each attempt (first try is immediate). */
export const STRIPE_JS_RETRY_DELAYS_MS = [0, 400, 1_200] as const

export type StripeBrowserPromise = Promise<Stripe | null> | null

export async function loadStripeWithRetry<T>(
  load: () => Promise<T | null>,
  deps: { sleep?: (ms: number) => Promise<void> } = {},
): Promise<T | null> {
  const sleep = deps.sleep ?? defaultSleep

  for (let attempt = 0; attempt < STRIPE_JS_LOAD_ATTEMPTS; attempt++) {
    const delay = STRIPE_JS_RETRY_DELAYS_MS[attempt] ?? 0
    if (delay > 0) await sleep(delay)
    try {
      const stripe = await load()
      if (stripe) return stripe
    } catch {
      // Script injection / network failure — retry while attempts remain.
    }
  }

  return null
}

export function createStripeBrowserLoader<T extends object>(options: {
  getKey: () => string
  loadStripe: (key: string) => Promise<T | null>
  sleep?: (ms: number) => Promise<void>
  isBrowser?: () => boolean
}): {
  get: () => Promise<T | null> | null
  retry: () => Promise<T | null> | null
  prefetch: () => void
} {
  let current: Promise<T | null> | null = null

  function get(): Promise<T | null> | null {
    const key = options.getKey().trim()
    if (!key) return null

    const isBrowser = options.isBrowser ?? defaultIsBrowser
    if (!isBrowser()) {
      return Promise.resolve(null)
    }

    current ??= loadStripeWithRetry(() => options.loadStripe(key), {
      sleep: options.sleep,
    })
    return current
  }

  function retry(): Promise<T | null> | null {
    current = null
    return get()
  }

  function prefetch(): void {
    const pending = get()
    if (pending) void pending.then(() => undefined, () => undefined)
  }

  return { get, retry, prefetch }
}

function defaultIsBrowser(): boolean {
  return typeof window !== "undefined"
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function ensureStripePreconnect(): void {
  if (typeof document === "undefined") return
  if (document.querySelector("link[data-reswell-stripe-preconnect]")) return

  const link = document.createElement("link")
  link.rel = "preconnect"
  link.href = "https://js.stripe.com"
  link.crossOrigin = "anonymous"
  link.setAttribute("data-reswell-stripe-preconnect", "")
  document.head.appendChild(link)
}

async function loadStripeFromCdn(key: string): Promise<Stripe | null> {
  // `/pure` does not inject the script on import — only when `loadStripe` runs.
  // The default `@stripe/stripe-js` entry auto-injects, which turned listing-page
  // prefetch into an unhandled `Failed to load Stripe.js` rejection.
  const { loadStripe } = await import("@stripe/stripe-js/pure")
  return loadStripe(key)
}

const stripeBrowserLoader = createStripeBrowserLoader({
  getKey: stripePublishableKey,
  loadStripe: loadStripeFromCdn,
})

export function getStripeBrowser(): StripeBrowserPromise {
  ensureStripePreconnect()
  return stripeBrowserLoader.get()
}

/** Drop a cached miss so checkout can try js.stripe.com again. */
export function retryStripeJs(): StripeBrowserPromise {
  ensureStripePreconnect()
  return stripeBrowserLoader.retry()
}

/** Start Stripe.js without surfacing a rejection if the CDN is blocked. */
export function prefetchStripeJs(): void {
  ensureStripePreconnect()
  stripeBrowserLoader.prefetch()
}
