import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  OFFER_CARD_DECLINED_ERROR,
  OFFER_CARD_NOT_CHARGED_ERROR,
  canCaptureOfferAuthorization,
  canReleaseOfferAuthorization,
  isBindingOfferPaymentIntent,
  isOfferAuthorizationCaptured,
  offerAuthorizationAmountMatches,
  offerChargeDeclineReason,
  offerChargeSnapshotFromPaymentIntent,
  offerDeclineMessageFromStripeError,
  offerIsBinding,
  shouldCleanupOrphanOfferBinding,
} from "./listing-offer-authorization.ts"

describe("isBindingOfferPaymentIntent", () => {
  it("requires the offer_binding metadata flag", () => {
    assert.equal(isBindingOfferPaymentIntent({ offer_binding: "1" }), true)
    assert.equal(isBindingOfferPaymentIntent({ offer_binding: "0" }), false)
    assert.equal(isBindingOfferPaymentIntent({}), false)
    assert.equal(isBindingOfferPaymentIntent(null), false)
  })
})

describe("offerAuthorizationAmountMatches", () => {
  it("requires an exact integer match at or above the Stripe minimum", () => {
    assert.equal(offerAuthorizationAmountMatches(5000, 5000), true)
    assert.equal(offerAuthorizationAmountMatches(49, 49), false)
    assert.equal(offerAuthorizationAmountMatches(5000, 5001), false)
    assert.equal(offerAuthorizationAmountMatches(50.5, 50.5), false)
  })
})

describe("authorization status helpers", () => {
  it("captures only requires_capture and treats succeeded as already captured", () => {
    assert.equal(canCaptureOfferAuthorization("requires_capture"), true)
    assert.equal(canCaptureOfferAuthorization("succeeded"), false)
    assert.equal(isOfferAuthorizationCaptured("succeeded"), true)
    assert.equal(isOfferAuthorizationCaptured("requires_capture"), false)
  })

  it("releases open authorizations but never a captured charge", () => {
    assert.equal(canReleaseOfferAuthorization("requires_capture"), true)
    assert.equal(canReleaseOfferAuthorization("requires_confirmation"), true)
    assert.equal(canReleaseOfferAuthorization("succeeded"), false)
    assert.equal(canReleaseOfferAuthorization("canceled"), false)
  })
})

describe("shouldCleanupOrphanOfferBinding", () => {
  const createdAtMs = Date.parse("2026-09-16T18:00:00.000Z")

  it("cancels binding PIs with no offer after an hour", () => {
    assert.equal(
      shouldCleanupOrphanOfferBinding({
        offerBinding: true,
        offerId: null,
        createdAtMs,
        referenceTimeMs: createdAtMs + 60 * 60 * 1000,
      }),
      true,
    )
  })

  it("keeps attached or fresh authorizations", () => {
    assert.equal(
      shouldCleanupOrphanOfferBinding({
        offerBinding: true,
        offerId: "offer-1",
        createdAtMs,
        referenceTimeMs: createdAtMs + 2 * 60 * 60 * 1000,
      }),
      false,
    )
    assert.equal(
      shouldCleanupOrphanOfferBinding({
        offerBinding: true,
        offerId: null,
        createdAtMs,
        referenceTimeMs: createdAtMs + 30 * 60 * 1000,
      }),
      false,
    )
    assert.equal(
      shouldCleanupOrphanOfferBinding({
        offerBinding: false,
        offerId: null,
        createdAtMs,
        referenceTimeMs: createdAtMs + 2 * 60 * 60 * 1000,
      }),
      false,
    )
  })
})

function capturedOfferPayment(overrides: Record<string, unknown> = {}) {
  return offerChargeSnapshotFromPaymentIntent({
    status: "succeeded",
    amount: 45585,
    amount_received: 45585,
    last_payment_error: null,
    latest_charge: {
      status: "succeeded",
      paid: true,
      captured: true,
      amount_captured: 45585,
      failure_code: null,
      outcome: { type: "authorized" },
    },
    ...overrides,
  })
}

describe("offerChargeDeclineReason", () => {
  it("accepts a fully captured charge", () => {
    assert.equal(offerChargeDeclineReason(capturedOfferPayment()), null)
  })

  it("rejects a declined charge even when the PaymentIntent says succeeded", () => {
    const reason = offerChargeDeclineReason(
      capturedOfferPayment({
        latest_charge: {
          status: "failed",
          paid: false,
          captured: false,
          amount_captured: 0,
          failure_code: "card_declined",
          outcome: { type: "issuer_declined" },
        },
      }),
    )
    assert.equal(reason, OFFER_CARD_DECLINED_ERROR)
  })

  it("rejects issuer declines and blocked outcomes", () => {
    assert.equal(
      offerChargeDeclineReason(
        capturedOfferPayment({
          latest_charge: {
            status: "failed",
            paid: false,
            captured: false,
            amount_captured: 0,
            failure_code: null,
            outcome: { type: "blocked" },
          },
        }),
      ),
      OFFER_CARD_DECLINED_ERROR,
    )
  })

  it("does not treat a stale decline on a captured charge as a failure", () => {
    assert.equal(
      offerChargeDeclineReason(
        capturedOfferPayment({
          last_payment_error: { code: "card_declined", decline_code: "insufficient_funds" },
        }),
      ),
      null,
    )
  })

  it("rejects an unexpanded charge and an uncaptured authorization", () => {
    assert.equal(
      offerChargeDeclineReason(
        offerChargeSnapshotFromPaymentIntent({
          status: "succeeded",
          amount: 45585,
          amount_received: 45585,
          latest_charge: "ch_123",
        }),
      ),
      OFFER_CARD_NOT_CHARGED_ERROR,
    )
    assert.equal(
      offerChargeDeclineReason(
        offerChargeSnapshotFromPaymentIntent({
          status: "requires_capture",
          amount: 45585,
          amount_received: 0,
          latest_charge: {
            status: "succeeded",
            paid: true,
            captured: false,
            amount_captured: 0,
            outcome: { type: "authorized" },
          },
        }),
      ),
      OFFER_CARD_NOT_CHARGED_ERROR,
    )
  })

  it("rejects a requires_payment_method decline", () => {
    assert.equal(
      offerChargeDeclineReason(
        offerChargeSnapshotFromPaymentIntent({
          status: "requires_payment_method",
          amount: 45585,
          amount_received: 0,
          last_payment_error: { code: "card_declined", decline_code: "generic_decline" },
          latest_charge: null,
        }),
      ),
      OFFER_CARD_DECLINED_ERROR,
    )
  })
})

describe("offerDeclineMessageFromStripeError", () => {
  it("reads card declines from the thrown Stripe error", () => {
    assert.equal(
      offerDeclineMessageFromStripeError({
        code: "card_declined",
        decline_code: "insufficient_funds",
      }),
      OFFER_CARD_DECLINED_ERROR,
    )
    assert.equal(
      offerDeclineMessageFromStripeError({
        payment_intent: {
          last_payment_error: { code: "card_declined", decline_code: "do_not_honor" },
        },
      }),
      OFFER_CARD_DECLINED_ERROR,
    )
    assert.equal(offerDeclineMessageFromStripeError(new Error("network")), null)
  })
})

describe("offerIsBinding", () => {
  it("is true when a payment intent is stored", () => {
    assert.equal(offerIsBinding({ payment_intent_id: "pi_123" }), true)
    assert.equal(offerIsBinding({ payment_intent_id: "  " }), false)
    assert.equal(offerIsBinding({}), false)
  })
})
