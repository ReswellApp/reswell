import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  isPostHogStripeJsCdnLoadError,
  isStripeJsCdnLoadError,
} from "@/lib/utils/is-stripe-js-cdn-error"

describe("isStripeJsCdnLoadError", () => {
  it("matches Stripe's Failed to load Stripe.js wrapper", () => {
    assert.equal(isStripeJsCdnLoadError(new Error("Failed to load Stripe.js")), true)
  })

  it("matches the raw script error Event PostHog serializes from onErrorListener", () => {
    assert.equal(
      isStripeJsCdnLoadError(
        "Event captured as exception with keys: isTrusted\nonErrorListener @stripe/stripe-js",
      ),
      true,
    )
  })

  it("matches a chained DOM Event cause", () => {
    const eventLike = { isTrusted: true }
    const error = new Error("Failed to load Stripe.js")
    Object.assign(error, { cause: eventLike })
    assert.equal(isStripeJsCdnLoadError(error), true)
  })

  it("does not drop checkout's exhausted-retry report", () => {
    assert.equal(
      isStripeJsCdnLoadError(new Error("Failed to load Stripe.js after retries")),
      false,
    )
  })

  it("does not match unrelated exceptions", () => {
    assert.equal(isStripeJsCdnLoadError(new Error("PaymentIntent failed")), false)
    assert.equal(isStripeJsCdnLoadError("Event captured as exception with keys: isTrusted"), false)
  })
})

describe("isPostHogStripeJsCdnLoadError", () => {
  it("drops the PostHog $exception pair from a script tag miss", () => {
    assert.equal(
      isPostHogStripeJsCdnLoadError({
        event: "$exception",
        properties: {
          $exception_message: "Failed to load Stripe.js",
          $exception_list: [
            { type: "Error", value: "Failed to load Stripe.js" },
            {
              type: "Event",
              value: "Event captured as exception with keys: isTrusted",
              $exception_stack_trace_raw: "onErrorListener",
            },
          ],
        },
      }),
      true,
    )
  })

  it("keeps exhausted checkout retries", () => {
    assert.equal(
      isPostHogStripeJsCdnLoadError({
        event: "$exception",
        properties: {
          $exception_message: "Failed to load Stripe.js after retries",
        },
      }),
      false,
    )
  })
})
