import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { citationsFromAgent } from "./cs-agent-citations.ts"

const linked = {
  id: "11111111-1111-1111-1111-111111111111",
  orderNum: "1042",
}
const lookedUp = {
  id: "22222222-2222-2222-2222-222222222222",
  orderNum: "1088",
}

describe("citationsFromAgent", () => {
  it("keeps a tool-looked-up in-scope order even when it is not the linked case order", () => {
    const cited = citationsFromAgent({
      orders: [linked, lookedUp],
      orderRefs: ["1088"],
      tickets: [],
      ticketIds: [],
    })
    assert.deepEqual(cited.orders, [{ id: lookedUp.id, orderRef: "1088" }])
  })

  it("still cites an in-scope order when the case has no linked order", () => {
    const cited = citationsFromAgent({
      orders: [null, lookedUp],
      orderRefs: [lookedUp.id],
      tickets: [],
      ticketIds: [],
    })
    assert.deepEqual(cited.orders, [{ id: lookedUp.id, orderRef: "1088" }])
  })

  it("drops refs that were never resolved in scope", () => {
    const cited = citationsFromAgent({
      orders: [linked],
      orderRefs: ["9999"],
      tickets: [],
      ticketIds: [],
    })
    assert.deepEqual(cited.orders, [])
  })
})
