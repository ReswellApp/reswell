import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  matchStripeConnectBankPayouts,
  planStripeConnectBankPayoutUpdates,
  usdToCents,
  type MatchPayout,
  type MatchTransfer,
} from "./stripeConnectBankPayoutMatch.ts"

const DAY = 86_400_000

function transfer(overrides: Partial<MatchTransfer> & Pick<MatchTransfer, "id" | "amountCents" | "createdAtMs">): MatchTransfer {
  return {
    payoutSpeed: "standard",
    status: "SUCCEEDED",
    stripePayoutId: null,
    bankPayoutStatus: null,
    expectedArrivalAtIso: null,
    ...overrides,
  }
}

function payout(overrides: Partial<MatchPayout> & Pick<MatchPayout, "id" | "amountCents" | "createdAtMs">): MatchPayout {
  return {
    arrivalDateMs: overrides.createdAtMs + 2 * DAY,
    status: "paid",
    method: "standard",
    transferRowId: null,
    ...overrides,
  }
}

describe("usdToCents", () => {
  it("rounds decimal dollars to cents", () => {
    assert.equal(usdToCents("69.75"), 6975)
    assert.equal(usdToCents(325.5), 32550)
    assert.equal(usdToCents("69.75") + usdToCents("325.50"), 39525)
  })
})

describe("matchStripeConnectBankPayouts", () => {
  it("marks a standard cash-out sent when one payout matches its amount", () => {
    const created = Date.parse("2026-09-11T15:00:00.000Z")
    const assignments = matchStripeConnectBankPayouts(
      [transfer({ id: "t1", amountCents: 257540, createdAtMs: created })],
      [payout({ id: "po_1", amountCents: 257540, createdAtMs: created + DAY, status: "paid" })],
    )
    assert.equal(assignments.length, 1)
    assert.equal(assignments[0]?.stripePayoutId, "po_1")
    assert.equal(assignments[0]?.bankPayoutStatus, "paid")
    assert.equal(assignments[0]?.expectedArrivalAtIso, new Date(created + DAY + 2 * DAY).toISOString())
  })

  it("batches same-day standard cash-outs into one ACH", () => {
    const first = Date.parse("2026-09-29T16:00:00.000Z")
    const second = first + 60_000
    const assignments = matchStripeConnectBankPayouts(
      [
        transfer({ id: "t-late", amountCents: 32550, createdAtMs: second }),
        transfer({ id: "t-early", amountCents: 6975, createdAtMs: first }),
      ],
      [
        payout({
          id: "po_batch",
          amountCents: 39525,
          createdAtMs: second + DAY,
          status: "in_transit",
        }),
      ],
    )
    const byId = new Map(assignments.map((row) => [row.transferId, row]))
    assert.equal(byId.get("t-early")?.stripePayoutId, "po_batch")
    assert.equal(byId.get("t-late")?.stripePayoutId, "po_batch")
    assert.equal(byId.get("t-early")?.bankPayoutStatus, "in_transit")
  })

  it("does not pair a payout with a later cash-out when the oldest amount does not fit", () => {
    const created = Date.parse("2026-09-01T12:00:00.000Z")
    const assignments = matchStripeConnectBankPayouts(
      [
        transfer({ id: "t1", amountCents: 10000, createdAtMs: created }),
        transfer({ id: "t2", amountCents: 4000, createdAtMs: created + 1000 }),
      ],
      [payout({ id: "po_partial", amountCents: 4000, createdAtMs: created + DAY })],
    )
    assert.equal(assignments.length, 0)
  })

  it("links an instant payout by id even when the bank amount is net of the fee", () => {
    const created = Date.parse("2026-08-27T18:00:00.000Z")
    const assignments = matchStripeConnectBankPayouts(
      [
        transfer({
          id: "t-instant",
          amountCents: 50000,
          createdAtMs: created,
          payoutSpeed: "instant",
          stripePayoutId: "po_instant",
        }),
      ],
      [
        payout({
          id: "po_instant",
          amountCents: 49250,
          createdAtMs: created,
          method: "instant",
          status: "paid",
          transferRowId: "t-instant",
        }),
      ],
    )
    assert.equal(assignments.length, 1)
    assert.equal(assignments[0]?.bankPayoutStatus, "paid")
    assert.equal(assignments[0]?.stripePayoutId, "po_instant")
  })

  it("lets a retry payout replace a failed ACH instead of leaving the cash-out failed", () => {
    const created = Date.parse("2026-09-04T12:00:00.000Z")
    const assignments = matchStripeConnectBankPayouts(
      [transfer({ id: "t1", amountCents: 51150, createdAtMs: created, bankPayoutStatus: "failed", stripePayoutId: "po_failed" })],
      [
        payout({ id: "po_failed", amountCents: 51150, createdAtMs: created + DAY, status: "failed" }),
        payout({ id: "po_retry", amountCents: 51150, createdAtMs: created + 3 * DAY, status: "paid" }),
      ],
    )
    assert.equal(assignments.length, 1)
    assert.equal(assignments[0]?.stripePayoutId, "po_retry")
    assert.equal(assignments[0]?.bankPayoutStatus, "paid")
  })

  it("records separate failed payouts in the order Stripe attempted them", () => {
    const first = Date.parse("2026-09-01T12:00:00.000Z")
    const second = Date.parse("2026-09-08T12:00:00.000Z")
    const assignments = matchStripeConnectBankPayouts(
      [
        transfer({ id: "t1", amountCents: 10000, createdAtMs: first }),
        transfer({ id: "t2", amountCents: 4000, createdAtMs: second }),
      ],
      [
        payout({ id: "po_1", amountCents: 10000, createdAtMs: first + DAY, status: "failed" }),
        payout({ id: "po_2", amountCents: 4000, createdAtMs: second + DAY, status: "failed" }),
      ],
    )
    const byId = new Map(assignments.map((row) => [row.transferId, row]))
    assert.equal(byId.get("t1")?.stripePayoutId, "po_1")
    assert.equal(byId.get("t2")?.stripePayoutId, "po_2")
    assert.equal(byId.get("t1")?.bankPayoutStatus, "failed")
    assert.equal(byId.get("t2")?.bankPayoutStatus, "failed")
  })

  it("records a failed payout when nothing has retried yet", () => {
    const created = Date.parse("2026-09-04T12:00:00.000Z")
    const assignments = matchStripeConnectBankPayouts(
      [transfer({ id: "t1", amountCents: 51150, createdAtMs: created })],
      [payout({ id: "po_failed", amountCents: 51150, createdAtMs: created + DAY, status: "failed" })],
    )
    assert.equal(assignments[0]?.bankPayoutStatus, "failed")
    assert.equal(assignments[0]?.stripePayoutId, "po_failed")
  })

  it("does not give an older payout a cash-out that did not exist yet", () => {
    const payoutCreated = Date.parse("2026-09-01T12:00:00.000Z")
    const assignments = matchStripeConnectBankPayouts(
      [transfer({ id: "t-later", amountCents: 8000, createdAtMs: payoutCreated + DAY })],
      [payout({ id: "po_old", amountCents: 8000, createdAtMs: payoutCreated, status: "paid" })],
    )
    assert.equal(assignments.length, 0)
  })

  it("keeps a paid payout attached when a later cash-out has the same amount", () => {
    const first = Date.parse("2026-08-01T12:00:00.000Z")
    const second = Date.parse("2026-09-01T12:00:00.000Z")
    const assignments = matchStripeConnectBankPayouts(
      [
        transfer({
          id: "t-paid",
          amountCents: 10000,
          createdAtMs: first,
          bankPayoutStatus: "paid",
          stripePayoutId: "po_old",
        }),
        transfer({ id: "t-open", amountCents: 10000, createdAtMs: second }),
      ],
      [
        payout({ id: "po_old", amountCents: 10000, createdAtMs: first + DAY, status: "paid" }),
        payout({ id: "po_new", amountCents: 10000, createdAtMs: second + DAY, status: "in_transit" }),
      ],
    )
    const byId = new Map(assignments.map((row) => [row.transferId, row]))
    assert.equal(byId.get("t-paid")?.stripePayoutId, "po_old")
    assert.equal(byId.get("t-open")?.stripePayoutId, "po_new")
    assert.equal(byId.get("t-open")?.bankPayoutStatus, "in_transit")
  })

  it("fills the rest of a batched payout if only one cash-out was saved as paid", () => {
    const created = Date.parse("2026-09-29T16:00:00.000Z")
    const assignments = matchStripeConnectBankPayouts(
      [
        transfer({
          id: "t1",
          amountCents: 6975,
          createdAtMs: created,
          bankPayoutStatus: "paid",
          stripePayoutId: "po_batch",
        }),
        transfer({ id: "t2", amountCents: 32550, createdAtMs: created + 1000 }),
      ],
      [payout({ id: "po_batch", amountCents: 39525, createdAtMs: created + DAY, status: "paid" })],
    )
    const byId = new Map(assignments.map((row) => [row.transferId, row]))
    assert.equal(byId.get("t1")?.bankPayoutStatus, "paid")
    assert.equal(byId.get("t2")?.stripePayoutId, "po_batch")
    assert.equal(byId.get("t2")?.bankPayoutStatus, "paid")
  })
})

describe("planStripeConnectBankPayoutUpdates", () => {
  it("skips a row that already matches the payout", () => {
    const arrival = "2026-09-30T00:00:00.000Z"
    const patches = planStripeConnectBankPayoutUpdates(
      [
        transfer({
          id: "t1",
          amountCents: 1000,
          createdAtMs: 1,
          stripePayoutId: "po_1",
          bankPayoutStatus: "paid",
          expectedArrivalAtIso: arrival,
        }),
      ],
      [
        {
          transferId: "t1",
          stripePayoutId: "po_1",
          bankPayoutStatus: "paid",
          expectedArrivalAtIso: arrival,
        },
      ],
    )
    assert.equal(patches.length, 0)
  })

  it("does not move a paid row back to in transit", () => {
    const patches = planStripeConnectBankPayoutUpdates(
      [
        transfer({
          id: "t1",
          amountCents: 1000,
          createdAtMs: 1,
          stripePayoutId: "po_1",
          bankPayoutStatus: "paid",
          expectedArrivalAtIso: "2026-09-30T00:00:00.000Z",
        }),
      ],
      [
        {
          transferId: "t1",
          stripePayoutId: "po_1",
          bankPayoutStatus: "in_transit",
          expectedArrivalAtIso: "2026-10-01T00:00:00.000Z",
        },
      ],
    )
    assert.equal(patches.length, 0)
  })

  it("replaces a failed payout with the retry", () => {
    const patches = planStripeConnectBankPayoutUpdates(
      [
        transfer({
          id: "t1",
          amountCents: 1000,
          createdAtMs: 1,
          stripePayoutId: "po_failed",
          bankPayoutStatus: "failed",
        }),
      ],
      [
        {
          transferId: "t1",
          stripePayoutId: "po_retry",
          bankPayoutStatus: "in_transit",
          expectedArrivalAtIso: "2026-10-02T00:00:00.000Z",
        },
      ],
    )
    assert.equal(patches.length, 1)
    assert.equal(patches[0]?.stripePayoutId, "po_retry")
    assert.equal(patches[0]?.bankPayoutStatus, "in_transit")
    assert.equal(patches[0]?.expectedArrivalAtIso, "2026-10-02T00:00:00.000Z")
  })
})
