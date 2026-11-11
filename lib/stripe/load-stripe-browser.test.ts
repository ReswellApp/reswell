import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  createStripeBrowserLoader,
  loadStripeWithRetry,
  STRIPE_JS_LOAD_ATTEMPTS,
  STRIPE_JS_RETRY_DELAYS_MS,
} from "@/lib/stripe/load-stripe-browser"

function fakeStripe(): { id: string } {
  return { id: "stripe" }
}

describe("loadStripeWithRetry", () => {
  it("returns the instance on the first success", async () => {
    const sleeps: number[] = []
    const stripe = fakeStripe()
    const result = await loadStripeWithRetry(async () => stripe, {
      sleep: async (ms) => {
        sleeps.push(ms)
      },
    })
    assert.equal(result, stripe)
    assert.deepEqual(sleeps, [])
  })

  it("retries after a thrown load error and then succeeds", async () => {
    const sleeps: number[] = []
    let attempts = 0
    const stripe = fakeStripe()
    const result = await loadStripeWithRetry(
      async () => {
        attempts += 1
        if (attempts < 2) throw new Error("Failed to load Stripe.js")
        return stripe
      },
      {
        sleep: async (ms) => {
          sleeps.push(ms)
        },
      },
    )
    assert.equal(result, stripe)
    assert.equal(attempts, 2)
    assert.deepEqual(sleeps, [STRIPE_JS_RETRY_DELAYS_MS[1]])
  })

  it("retries when load resolves null", async () => {
    let attempts = 0
    const stripe = fakeStripe()
    const result = await loadStripeWithRetry(
      async () => {
        attempts += 1
        return attempts === STRIPE_JS_LOAD_ATTEMPTS ? stripe : null
      },
      { sleep: async () => undefined },
    )
    assert.equal(result, stripe)
    assert.equal(attempts, STRIPE_JS_LOAD_ATTEMPTS)
  })

  it("returns null after every attempt fails", async () => {
    let attempts = 0
    const result = await loadStripeWithRetry(
      async () => {
        attempts += 1
        throw new Error("Failed to load Stripe.js")
      },
      { sleep: async () => undefined },
    )
    assert.equal(result, null)
    assert.equal(attempts, STRIPE_JS_LOAD_ATTEMPTS)
  })
})

describe("createStripeBrowserLoader", () => {
  it("returns null when the publishable key is missing", () => {
    const loader = createStripeBrowserLoader({
      getKey: () => "  ",
      loadStripe: async () => fakeStripe(),
      isBrowser: () => true,
    })
    assert.equal(loader.get(), null)
  })

  it("does not contact the CDN during SSR", async () => {
    let loads = 0
    const loader = createStripeBrowserLoader({
      getKey: () => "pk_test_123",
      loadStripe: async () => {
        loads += 1
        return fakeStripe()
      },
      isBrowser: () => false,
    })
    assert.equal(await loader.get(), null)
    assert.equal(loads, 0)
  })

  it("caches a successful load", async () => {
    let loads = 0
    const stripe = fakeStripe()
    const loader = createStripeBrowserLoader({
      getKey: () => "pk_test_123",
      loadStripe: async () => {
        loads += 1
        return stripe
      },
      isBrowser: () => true,
    })
    assert.equal(await loader.get(), stripe)
    assert.equal(await loader.get(), stripe)
    assert.equal(loads, 1)
  })

  it("does not auto-retry a cached miss until retry() is called", async () => {
    let loads = 0
    const stripe = fakeStripe()
    const loader = createStripeBrowserLoader({
      getKey: () => "pk_test_123",
      loadStripe: async () => {
        loads += 1
        if (loads <= STRIPE_JS_LOAD_ATTEMPTS) throw new Error("Failed to load Stripe.js")
        return stripe
      },
      isBrowser: () => true,
      sleep: async () => undefined,
    })

    assert.equal(await loader.get(), null)
    assert.equal(loads, STRIPE_JS_LOAD_ATTEMPTS)
    assert.equal(await loader.get(), null)
    assert.equal(loads, STRIPE_JS_LOAD_ATTEMPTS)

    assert.equal(await loader.retry(), stripe)
    assert.equal(loads, STRIPE_JS_LOAD_ATTEMPTS + 1)
  })

  it("prefetch swallows a failed load so it is not an unhandled rejection", async () => {
    const loader = createStripeBrowserLoader({
      getKey: () => "pk_test_123",
      loadStripe: async () => {
        throw new Error("Failed to load Stripe.js")
      },
      isBrowser: () => true,
      sleep: async () => undefined,
    })

    loader.prefetch()
    assert.equal(await loader.get(), null)
  })
})
