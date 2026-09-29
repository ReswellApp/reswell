import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  executePostageRecovery,
  type PostageRecoveryDeps,
  type PostageRecoveryLabel,
} from "./recover-unused-postage.ts"

const NOW = new Date("2026-09-29T12:00:00.000Z")
const UPS = "se-6450247"

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString()
}

function label(partial: Partial<PostageRecoveryLabel> & { labelId: string }): PostageRecoveryLabel {
  return {
    createdAt: daysAgo(5),
    trackingNumber: partial.labelId,
    carrierCode: "usps",
    carrierId: "se-usps",
    serviceCode: "usps_ground_advantage",
    voided: false,
    isReturnLabel: false,
    postageUsd: 10,
    insuranceUsd: 1,
    orderId: "order-1",
    adminVoidRequested: false,
    attemptCount: 0,
    ...partial,
  }
}

function deps(overrides: Partial<PostageRecoveryDeps> = {}): PostageRecoveryDeps & {
  voids: string[]
} {
  const voids: string[] = []
  return {
    voids,
    trackLabel: async () => ({ scanned: false, statusCode: "NY" }),
    readLabel: async () => ({ voided: true, carrierId: "se-usps" }),
    voidLabel: async (labelId) => {
      voids.push(labelId)
      return { ok: true as const, approved: true, message: "Request for refund submitted." }
    },
    ...overrides,
    voidLabel: overrides.voidLabel
      ? overrides.voidLabel
      : async (labelId) => {
          voids.push(labelId)
          return { ok: true as const, approved: true, message: "Request for refund submitted." }
        },
  }
}

describe("executePostageRecovery", () => {
  it("voids only unscanned labels at 20 days and confirms the label is voided", async () => {
    const client2 = deps({
      trackLabel: async (labelId) => {
        if (labelId === "se-scanned") return { scanned: true, statusCode: "IT" }
        return { scanned: false, statusCode: "NY" }
      },
    })
    const confirmed = await executePostageRecovery({
      now: NOW,
      autoVoidEnabled: true,
      reswellUpsCarrierId: UPS,
      truncated: false,
      deps: client2,
      labels: [
        label({ labelId: "se-young", createdAt: daysAgo(4), postageUsd: 8, insuranceUsd: 0 }),
        label({ labelId: "se-stale", createdAt: daysAgo(21), postageUsd: 12.5, insuranceUsd: 0.5 }),
        label({ labelId: "se-scanned", createdAt: daysAgo(22), postageUsd: 30, insuranceUsd: 0 }),
        label({ labelId: "se-voided", createdAt: daysAgo(6), voided: true, postageUsd: 9, insuranceUsd: 0 }),
      ],
    })

    assert.deepEqual(client2.voids, ["se-stale"])
    assert.equal(confirmed.buyerRefundsIssued, 0)
    assert.equal(confirmed.summary.buyerRefundsIssued, 0)
    assert.equal(confirmed.summary.voidedThisRunCount, 1)
    assert.equal(confirmed.summary.voidedThisRunUsd, 13)
    assert.equal(confirmed.summary.recoveredBalanceUsd, 22)
    assert.equal(confirmed.summary.scannedKeptUsd, 30)
    assert.equal(confirmed.summary.inGraceCount, 1)
    assert.equal(confirmed.recoveredThisRun[0]?.shipengineVoided, true)
  })

  it("does not void when the carrier will not confirm the label is unused", async () => {
    const client = deps({
      trackLabel: async () => null,
    })
    const run = await executePostageRecovery({
      now: NOW,
      autoVoidEnabled: true,
      reswellUpsCarrierId: UPS,
      truncated: false,
      deps: client,
      labels: [label({ labelId: "se-unknown", createdAt: daysAgo(24), postageUsd: 40, insuranceUsd: 0 })],
    })

    assert.deepEqual(client.voids, [])
    assert.equal(run.rows[0]?.disposition, "scan_unconfirmed")
    assert.equal(run.summary.cracksUsd, 40)
    assert.equal(run.buyerRefundsIssued, 0)
  })

  it("leaves a denied void as a crack and does not count it as recovered", async () => {
    const client = deps({
      voidLabel: async (labelId) => {
        client.voids.push(labelId)
        return { ok: true, approved: false, message: "Label has been scanned." }
      },
    })
    const run = await executePostageRecovery({
      now: NOW,
      autoVoidEnabled: true,
      reswellUpsCarrierId: UPS,
      truncated: false,
      deps: client,
      labels: [label({ labelId: "se-denied", createdAt: daysAgo(21) })],
    })

    assert.deepEqual(client.voids, ["se-denied"])
    assert.equal(run.rows[0]?.disposition, "void_denied")
    assert.equal(run.summary.recoveredBalanceUsd, 0)
    assert.equal(run.summary.voidDeniedUsd, 11)
    assert.equal(run.summary.voidedThisRunCount, 0)
  })

  it("holds an approved void as pending until ShipEngine marks the label voided", async () => {
    const client = deps({
      readLabel: async () => ({ voided: false, carrierId: "se-usps" }),
    })
    const run = await executePostageRecovery({
      now: NOW,
      autoVoidEnabled: true,
      reswellUpsCarrierId: UPS,
      truncated: false,
      deps: client,
      labels: [label({ labelId: "se-pending", createdAt: daysAgo(21), postageUsd: 7, insuranceUsd: 0 })],
    })

    assert.equal(run.rows[0]?.disposition, "refund_pending")
    assert.equal(run.rows[0]?.shipengineVoided, false)
    assert.equal(run.summary.refundPendingUsd, 7)
    assert.equal(run.summary.voidedThisRunCount, 0)
  })

  it("retries an unconfirmed admin void even inside the grace period", async () => {
    const client = deps()
    const run = await executePostageRecovery({
      now: NOW,
      autoVoidEnabled: true,
      reswellUpsCarrierId: UPS,
      truncated: false,
      deps: client,
      labels: [
        label({
          labelId: "se-admin",
          createdAt: daysAgo(2),
          adminVoidRequested: true,
          attemptCount: 1,
          postageUsd: 15,
          insuranceUsd: 0,
        }),
      ],
    })

    assert.deepEqual(client.voids, ["se-admin"])
    assert.equal(run.rows[0]?.attemptCount, 2)
    assert.equal(run.rows[0]?.voidedThisRun, true)
    assert.equal(run.summary.voidedThisRunUsd, 15)
  })

  it("voids an unused return label without treating it as a buyer refund", async () => {
    const client = deps()
    const run = await executePostageRecovery({
      now: NOW,
      autoVoidEnabled: true,
      reswellUpsCarrierId: UPS,
      truncated: false,
      deps: client,
      labels: [
        label({
          labelId: "se-return",
          createdAt: daysAgo(22),
          isReturnLabel: true,
          postageUsd: 11,
          insuranceUsd: 0,
        }),
      ],
    })

    assert.deepEqual(client.voids, ["se-return"])
    assert.equal(run.rows[0]?.isReturnLabel, true)
    assert.equal(run.buyerRefundsIssued, 0)
  })
})
