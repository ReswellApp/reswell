import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mobileEarningsSchema } from "@reswell/api-contract"

const earningsPayload = {
  available_usd: 10,
  available_label: "$10.00",
  ready_usd: 10,
  ready_label: "$10.00",
  pending_usd: 0,
  pending_label: "$0.00",
  cashed_out_usd: 0,
  cashed_out_label: "$0.00",
  lifetime_usd: 10,
  lifetime_label: "$10.00",
  earned_last_30d_usd: 10,
  earned_last_30d_label: "$10.00",
  credit_usd: 0,
  credit_label: "$0.00",
  payout_label: "No bank connected",
  payout_detail: "Payouts use Stripe Connect.",
  cash_out_ready: false,
  minimum_usd: 10,
  instant_fee_rate: 0.015,
  banks: [],
  pending_items: [],
  ready_items: [],
  activity: [],
}

describe("mobile earnings credit visibility", () => {
  it("hides Reswell Credit when credit_visible is omitted", () => {
    const parsed = mobileEarningsSchema.parse(earningsPayload)
    assert.equal(parsed.credit_visible, false)
  })

  it("shows Reswell Credit only when the admin pilot flag is true", () => {
    const parsed = mobileEarningsSchema.parse({ ...earningsPayload, credit_visible: true })
    assert.equal(parsed.credit_visible, true)
  })
})
