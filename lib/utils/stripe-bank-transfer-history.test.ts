import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  formatPayoutAmount,
  historyTriggerSummary,
  transferNeedsAttention,
} from "./stripe-bank-transfer-history.ts"

describe("formatPayoutAmount", () => {
  it("formats numeric and string amounts to two decimals", () => {
    assert.equal(formatPayoutAmount(1562.4), "1562.40")
    assert.equal(formatPayoutAmount("312.68"), "312.68")
  })
})

describe("transferNeedsAttention", () => {
  it("opens for in-transit ACH and failed payouts", () => {
    assert.equal(
      transferNeedsAttention({
        amount: 100,
        status: "SUCCEEDED",
        bank_payout_status: "in_transit",
      }),
      true,
    )
    assert.equal(
      transferNeedsAttention({
        amount: 100,
        status: "SUCCEEDED",
        bank_payout_status: "failed",
      }),
      true,
    )
  })

  it("stays closed for sent payouts", () => {
    assert.equal(
      transferNeedsAttention({
        amount: 100,
        status: "SUCCEEDED",
        bank_payout_status: "paid",
      }),
      false,
    )
  })
})

describe("historyTriggerSummary", () => {
  it("shows count and latest amount when everything is sent", () => {
    assert.equal(
      historyTriggerSummary([
        { amount: 1562.4, status: "SUCCEEDED", bank_payout_status: "paid" },
        { amount: 312.68, status: "SUCCEEDED", bank_payout_status: "paid" },
      ]),
      "2 transfers · Latest $1562.40",
    )
  })

  it("calls out processing and failed instead of the latest amount", () => {
    assert.equal(
      historyTriggerSummary([
        {
          amount: 200,
          status: "SUCCEEDED",
          payout_speed: "standard",
          bank_payout_status: "in_transit",
        },
        { amount: 50, status: "SUCCEEDED", bank_payout_status: "failed" },
        { amount: 10, status: "SUCCEEDED", bank_payout_status: "paid" },
      ]),
      "3 transfers · 1 processing · 1 failed",
    )
  })

  it("uses the singular label for one transfer", () => {
    assert.equal(
      historyTriggerSummary([{ amount: 10, status: "SUCCEEDED", bank_payout_status: "paid" }]),
      "1 transfer · Latest $10.00",
    )
  })
})
