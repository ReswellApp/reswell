import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { assessCsAgentRefundEligibility } from "./cs-agent-refund.ts"

describe("assessCsAgentRefundEligibility", () => {
  it("blocks a second refund on an already refunded order", () => {
    const result = assessCsAgentRefundEligibility({
      status: "refunded",
      amount: 420,
      paymentMethod: "stripe",
    })
    assert.equal(result.alreadyRefunded, true)
    assert.equal(result.staffMayRefund, false)
    assert.match(result.customerFacing, /already/i)
    assert.doesNotMatch(result.customerFacing, /approved|issued|we will refund/i)
  })

  it("treats refunding as in progress without a new customer promise", () => {
    const result = assessCsAgentRefundEligibility({
      status: "refunding",
      amount: 199,
      paymentMethod: "wallet",
    })
    assert.equal(result.inProgress, true)
    assert.equal(result.staffMayRefund, true)
    assert.match(result.customerFacing, /in progress/i)
    assert.doesNotMatch(result.customerFacing, /approved/i)
  })

  it("does not treat unpaid pending orders as refundable", () => {
    const result = assessCsAgentRefundEligibility({
      status: "pending",
      amount: 80,
    })
    assert.equal(result.staffMayRefund, false)
    assert.match(result.customerFacing, /do not promise/i)
  })

  it("lets staff review a confirmed order but forbids a customer promise", () => {
    const result = assessCsAgentRefundEligibility({
      status: "confirmed",
      amount: 350,
      paymentMethod: "stripe",
      fulfillmentMethod: "shipping",
      deliveryStatus: "pending",
      repairCreditTotal: 40,
    })
    assert.equal(result.staffMayRefund, true)
    assert.match(result.staffNote, /350/)
    assert.match(result.staffNote, /double-pay/)
    assert.match(result.customerFacing, /do not tell the customer/i)
  })
})
