import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { csAgentOrderIsInScope } from "./cs-agent-scope.ts"

const order = {
  id: "order-1",
  buyerId: "buyer-1",
  sellerId: "seller-1",
}

describe("csAgentOrderIsInScope", () => {
  it("allows the order linked to this case even without a user id", () => {
    assert.equal(
      csAgentOrderIsInScope(order, { requesterUserId: null, linkedOrderId: "order-1" }),
      true,
    )
  })

  it("allows the requester as buyer or seller", () => {
    assert.equal(
      csAgentOrderIsInScope(order, { requesterUserId: "buyer-1", linkedOrderId: null }),
      true,
    )
    assert.equal(
      csAgentOrderIsInScope(order, { requesterUserId: "seller-1", linkedOrderId: null }),
      true,
    )
  })

  it("hides another customer's order", () => {
    assert.equal(
      csAgentOrderIsInScope(order, {
        requesterUserId: "someone-else",
        linkedOrderId: "order-99",
      }),
      false,
    )
  })
})
