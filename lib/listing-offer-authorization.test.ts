import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  canCaptureOfferAuthorization,
  canReleaseOfferAuthorization,
  isBindingOfferPaymentIntent,
  isOfferAuthorizationCaptured,
  offerAuthorizationAmountMatches,
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

describe("offerIsBinding", () => {
  it("is true when a payment intent is stored", () => {
    assert.equal(offerIsBinding({ payment_intent_id: "pi_123" }), true)
    assert.equal(offerIsBinding({ payment_intent_id: "  " }), false)
    assert.equal(offerIsBinding({}), false)
  })
})
