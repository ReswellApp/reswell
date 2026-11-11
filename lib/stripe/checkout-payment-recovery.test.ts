import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  paidPaymentIntentIdFromConfirmResult,
  paymentIntentIdFromClientSecret,
  stripeConfirmErrorLooksAlreadySucceeded,
  stripePaymentIntentLooksPaid,
} from "@/lib/stripe/checkout-payment-recovery"

describe("checkout payment recovery", () => {
  it("parses the PaymentIntent id from a client secret", () => {
    assert.equal(
      paymentIntentIdFromClientSecret("pi_3UZBjDDUWcatSsWO0ViDYE7H_secret_abc"),
      "pi_3UZBjDDUWcatSsWO0ViDYE7H",
    )
    assert.equal(paymentIntentIdFromClientSecret("not-a-secret"), null)
  })

  it("treats succeeded and processing as paid", () => {
    assert.equal(stripePaymentIntentLooksPaid("succeeded"), true)
    assert.equal(stripePaymentIntentLooksPaid("processing"), true)
    assert.equal(stripePaymentIntentLooksPaid("requires_payment_method"), false)
  })

  it("recovers a succeeded PaymentIntent attached to a Stripe.js error", () => {
    assert.equal(
      paidPaymentIntentIdFromConfirmResult({
        error: {
          message: "We are unable to authenticate your payment method. Please choose a different payment method and try again.",
          payment_intent: { id: "pi_paid", status: "succeeded" },
        },
      }),
      "pi_paid",
    )
  })

  it("recovers a paid tip when Stripe.js reports a processing error", () => {
    assert.equal(
      paidPaymentIntentIdFromConfirmResult({
        error: {
          message: "A processing error occurred.",
          payment_intent: { id: "pi_tip", status: "succeeded" },
        },
      }),
      "pi_tip",
    )
    assert.equal(
      paidPaymentIntentIdFromConfirmResult({
        error: {
          message: "A processing error occurred.",
          payment_intent: { id: "pi_tip_processing", status: "processing" },
        },
      }),
      "pi_tip_processing",
    )
  })

  it("recovers already-succeeded confirm errors via the client secret", () => {
    assert.equal(
      stripeConfirmErrorLooksAlreadySucceeded({
        code: "payment_intent_unexpected_state",
        message: "You cannot confirm this PaymentIntent because it has a status of succeeded.",
      }),
      true,
    )
    assert.equal(
      paidPaymentIntentIdFromConfirmResult({
        error: {
          code: "payment_intent_unexpected_state",
          message: "You cannot confirm this PaymentIntent because it has a status of succeeded.",
        },
        clientSecret: "pi_3abc_secret_zzz",
      }),
      "pi_3abc",
    )
  })
})
