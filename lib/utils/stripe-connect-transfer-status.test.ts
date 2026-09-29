import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { bankTransferBadge, formatStripeArrivalDay } from "./stripe-connect-transfer-status.ts"

describe("formatStripeArrivalDay", () => {
  it("formats Stripe's UTC midnight as that calendar day", () => {
    assert.equal(formatStripeArrivalDay("2026-09-30T00:00:00.000Z"), "Sep 30")
  })
})

describe("bankTransferBadge", () => {
  it("keeps an unmatched standard cash-out on Processing", () => {
    const badge = bankTransferBadge({ status: "SUCCEEDED", payoutSpeed: "standard" })
    assert.equal(badge.kind, "processing")
    assert.equal(badge.hint, null)
  })

  it("shows the expected deposit date while the ACH is in transit", () => {
    const badge = bankTransferBadge({
      status: "SUCCEEDED",
      payoutSpeed: "standard",
      bankPayoutStatus: "in_transit",
      expectedArrivalAt: "2026-10-01T00:00:00.000Z",
    })
    assert.deepEqual(badge, { kind: "processing", label: "Processing", hint: "Arrives Oct 1" })
  })

  it("switches a standard cash-out to Sent once Stripe marks the payout paid", () => {
    const badge = bankTransferBadge({
      status: "SUCCEEDED",
      payoutSpeed: "standard",
      bankPayoutStatus: "paid",
      expectedArrivalAt: "2026-09-30T00:00:00.000Z",
    })
    assert.deepEqual(badge, { kind: "sent", label: "Sent", hint: "Deposit Sep 30" })
  })

  it("shows Sent for an instant payout that has not been synced yet", () => {
    const badge = bankTransferBadge({ status: "SUCCEEDED", payoutSpeed: "instant" })
    assert.equal(badge.kind, "sent")
    assert.equal(badge.hint, null)
  })

  it("shows Processing for an instant payout that is still in transit", () => {
    const badge = bankTransferBadge({
      status: "SUCCEEDED",
      payoutSpeed: "instant",
      bankPayoutStatus: "in_transit",
      expectedArrivalAt: "2026-08-27T00:00:00.000Z",
    })
    assert.equal(badge.kind, "processing")
    assert.equal(badge.hint, "Arrives Aug 27")
  })

  it("shows Failed while Stripe still holds the funds for a retry", () => {
    const badge = bankTransferBadge({
      status: "SUCCEEDED",
      payoutSpeed: "standard",
      bankPayoutStatus: "failed",
    })
    assert.equal(badge.kind, "failed")
    assert.equal(badge.hint, "Stripe will retry")
  })

  it("prefers Reversed when the wallet was credited back", () => {
    const badge = bankTransferBadge({
      status: "REVERSED",
      payoutSpeed: "instant",
      bankPayoutStatus: "failed",
    })
    assert.equal(badge.kind, "reversed")
  })
})
