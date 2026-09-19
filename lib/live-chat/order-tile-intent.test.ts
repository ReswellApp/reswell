import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isLiveChatMarketplaceHowtoIntent,
  isLiveChatSpecificOrderLookupIntent,
  latestLiveChatSpecificOrderLookupMessage,
  liveChatMessageNamesOrder,
  liveChatOrderLookupRole,
  liveChatOrderTileClickMessage,
  liveChatOrderTileReplyForOrders,
  resolveLiveChatOrderTileRole,
} from "./order-tile-intent.ts"

describe("live chat order tile intent", () => {
  it("shows tiles for this-order tracking, payout, and refund asks", () => {
    assert.equal(isLiveChatSpecificOrderLookupIntent("Where is my order?"), true)
    assert.equal(isLiveChatSpecificOrderLookupIntent("Where is my purchase?"), true)
    assert.equal(isLiveChatSpecificOrderLookupIntent("Where is my sale?"), true)
    assert.equal(isLiveChatSpecificOrderLookupIntent("Can you check tracking on my package?"), true)
    assert.equal(isLiveChatSpecificOrderLookupIntent("I want a refund"), true)
    assert.equal(isLiveChatSpecificOrderLookupIntent("Where is my payout?"), true)
    assert.equal(isLiveChatSpecificOrderLookupIntent("My sale is still pending — is it stuck?"), true)
  })

  it("does not show tiles on marketplace how-tos, including Hayden's sold-board money ask", () => {
    assert.equal(
      isLiveChatMarketplaceHowtoIntent("hi there. i sold a board. how do i get my money?"),
      true,
    )
    assert.equal(
      isLiveChatSpecificOrderLookupIntent("hi there. i sold a board. how do i get my money?"),
      false,
    )
    assert.equal(isLiveChatSpecificOrderLookupIntent("How do I get paid after a sale?"), false)
    assert.equal(isLiveChatSpecificOrderLookupIntent("how do cash outs work"), false)
    assert.equal(isLiveChatSpecificOrderLookupIntent("how do I buy a surfboard on Reswell?"), false)
    assert.equal(isLiveChatSpecificOrderLookupIntent("what's your refund policy?"), false)
  })

  it("does not show tiles when they already named an order or asked for a label update", () => {
    assert.equal(liveChatMessageNamesOrder("It's order #1042"), true)
    assert.equal(isLiveChatSpecificOrderLookupIntent("It's order #1042"), false)
    assert.equal(isLiveChatSpecificOrderLookupIntent("Where is order 1042?"), false)
    assert.equal(isLiveChatSpecificOrderLookupIntent("I need to update my shipping label"), false)
  })

  it("knows bought vs sold from the ask, and asks when it is ambiguous", () => {
    assert.equal(liveChatOrderLookupRole("I want a refund"), "buyer")
    assert.equal(liveChatOrderLookupRole("Where is my purchase?"), "buyer")
    assert.equal(liveChatOrderLookupRole("Where is my payout?"), "seller")
    assert.equal(liveChatOrderLookupRole("My sale is still pending — is it stuck?"), "seller")
    assert.equal(liveChatOrderLookupRole("Where is my order?"), null)

    const mixed = [{ role: "buyer" as const }, { role: "seller" as const }]
    assert.equal(resolveLiveChatOrderTileRole({ orders: mixed, inferredRole: null }), null)
    assert.equal(resolveLiveChatOrderTileRole({ orders: mixed, inferredRole: "buyer" }), "buyer")
    assert.equal(
      resolveLiveChatOrderTileRole({
        orders: [{ role: "seller" }],
        inferredRole: null,
      }),
      "seller",
    )
    assert.match(
      liveChatOrderTileReplyForOrders(mixed, "Where is my order?"),
      /bought or sold/i,
    )
    assert.match(
      liveChatOrderTileReplyForOrders(mixed, "I want a refund"),
      /purchase/i,
    )
  })

  it("sends a visitor message with the order number on tap", () => {
    assert.equal(liveChatOrderTileClickMessage("1042"), "It's order #1042")
    assert.equal(liveChatOrderTileClickMessage("#1042"), "It's order #1042")
    assert.equal(liveChatOrderTileClickMessage("1042", "buyer"), "It's purchase #1042")
    assert.equal(liveChatOrderTileClickMessage("1042", "seller"), "It's sale #1042")
  })

  it("clears tiles once the visitor moves on or taps an order", () => {
    assert.equal(
      latestLiveChatSpecificOrderLookupMessage([
        { id: "1", sender_type: "visitor", content: "Where is my order?" },
        { id: "2", sender_type: "visitor", content: "It's order #1042" },
      ]),
      null,
    )
    assert.deepEqual(
      latestLiveChatSpecificOrderLookupMessage([
        { id: "1", sender_type: "visitor", content: "hi" },
        { id: "2", sender_type: "visitor", content: "Where is my refund?" },
      ]),
      { id: "2", content: "Where is my refund?" },
    )
  })
})
