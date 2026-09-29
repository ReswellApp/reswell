import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { planUnusedLabelVoid } from "./unused-label-void-policy.ts"

const NOW = new Date("2026-09-29T12:00:00.000Z")
const UPS = "se-6450247"

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString()
}

function plan(overrides: Partial<Parameters<typeof planUnusedLabelVoid>[0]>) {
  return planUnusedLabelVoid({
    now: NOW,
    createdAtIso: daysAgo(10),
    voided: false,
    carrierCode: "stamps_com",
    carrierId: "se-usps",
    scanned: false,
    adminVoidRequested: false,
    autoVoidEnabled: true,
    reswellUpsCarrierId: UPS,
    ...overrides,
  })
}

describe("planUnusedLabelVoid", () => {
  it("holds an unscanned label inside the 20-day grace period", () => {
    const result = plan({ createdAtIso: daysAgo(10), scanned: false })
    assert.equal(result.action, "none")
    assert.equal(result.disposition, "in_grace")
  })

  it("flags unscanned labels approaching the auto-void day", () => {
    const result = plan({ createdAtIso: daysAgo(18), scanned: false })
    assert.equal(result.action, "none")
    assert.equal(result.disposition, "approaching")
  })

  it("voids an unscanned USPS label at 20 days for a balance credit", () => {
    const result = plan({ createdAtIso: daysAgo(20), carrierCode: "usps" })
    assert.equal(result.action, "void")
    assert.equal(result.disposition, "voided_balance")
    assert.equal(result.recoveryKind, "balance")
    assert.equal(result.deadlineDays, 28)
  })

  it("keeps a label the carrier has scanned", () => {
    const result = plan({ createdAtIso: daysAgo(25), scanned: true })
    assert.equal(result.action, "none")
    assert.equal(result.disposition, "scanned_keep")
  })

  it("does not void when tracking cannot prove the label is unused", () => {
    const result = plan({ createdAtIso: daysAgo(22), scanned: null })
    assert.equal(result.action, "none")
    assert.equal(result.disposition, "scan_unconfirmed")
  })

  it("marks USPS postage lost once the 28-day void window has closed", () => {
    const result = plan({ createdAtIso: daysAgo(28), carrierCode: "usps", scanned: false })
    assert.equal(result.action, "none")
    assert.equal(result.disposition, "expired_unrecoverable")
    assert.equal(result.pastDeadline, true)
  })

  it("still voids USPS on the last day inside the window", () => {
    const result = plan({ createdAtIso: daysAgo(27.9), carrierCode: "stamps_com" })
    assert.equal(result.action, "void")
    assert.equal(result.pastDeadline, false)
  })

  it("voids Reswell's own UPS account without calling it a wallet credit", () => {
    const result = plan({
      createdAtIso: daysAgo(21),
      carrierCode: "ups",
      carrierId: UPS,
    })
    assert.equal(result.action, "void")
    assert.equal(result.disposition, "voided_ups_account")
    assert.equal(result.recoveryKind, "ups_account")
    assert.equal(result.deadlineDays, 30)
  })

  it("retries an admin void before day 20 when the label is still unused", () => {
    const result = plan({ createdAtIso: daysAgo(3), adminVoidRequested: true, scanned: false })
    assert.equal(result.action, "void")
  })

  it("does not retry an admin void after the carrier has the package", () => {
    const result = plan({ createdAtIso: daysAgo(3), adminVoidRequested: true, scanned: true })
    assert.equal(result.action, "none")
    assert.equal(result.disposition, "scanned_keep")
  })

  it("records an already-voided wallet label as recovered balance", () => {
    const result = plan({ voided: true, scanned: true, createdAtIso: daysAgo(4) })
    assert.equal(result.action, "none")
    assert.equal(result.disposition, "voided_balance")
  })

  it("skips the void call when auto-void is disabled", () => {
    const result = plan({ createdAtIso: daysAgo(22), autoVoidEnabled: false })
    assert.equal(result.action, "none")
    assert.equal(result.disposition, "void_skipped")
  })
})
