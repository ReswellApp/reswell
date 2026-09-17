import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isLiveChatShipFromLabelUpdateIntent,
  latestLiveChatShipFromLabelUpdateMessage,
  threadHasLiveChatShipFromLabelUpdateIntent,
} from "./label-update-intent.ts"

describe("isLiveChatShipFromLabelUpdateIntent", () => {
  it("matches common ship-from / label update asks", () => {
    assert.equal(
      isLiveChatShipFromLabelUpdateIntent("I need to update one of my shipping labels"),
      true,
    )
    assert.equal(
      isLiveChatShipFromLabelUpdateIntent("I need to update on of my shipping labels"),
      true,
    )
    assert.equal(isLiveChatShipFromLabelUpdateIntent("wrong from address on the label"), true)
    assert.equal(isLiveChatShipFromLabelUpdateIntent("can I change the ship-from?"), true)
    assert.equal(isLiveChatShipFromLabelUpdateIntent("udpate my shipping label"), true)
  })

  it("ignores unrelated support asks", () => {
    assert.equal(isLiveChatShipFromLabelUpdateIntent("Where is my order?"), false)
    assert.equal(isLiveChatShipFromLabelUpdateIntent("I want a refund"), false)
    assert.equal(isLiveChatShipFromLabelUpdateIntent("?"), false)
    assert.equal(isLiveChatShipFromLabelUpdateIntent("any update"), false)
  })

  it("clears panel intent once the visitor moves on", () => {
    assert.equal(
      latestLiveChatShipFromLabelUpdateMessage([
        { id: "1", sender_type: "visitor", content: "I need to update on of my shipping labels" },
        { id: "2", sender_type: "visitor", content: "actually where is my refund?" },
      ]),
      null,
    )
  })

  it("keeps panel intent while the latest ask is still about labels", () => {
    assert.deepEqual(
      latestLiveChatShipFromLabelUpdateMessage([
        { id: "1", sender_type: "visitor", content: "hi" },
        { id: "2", sender_type: "visitor", content: "I need to update my shipping label" },
      ]),
      { id: "2", content: "I need to update my shipping label" },
    )
    assert.equal(
      threadHasLiveChatShipFromLabelUpdateIntent([
        { sender_type: "visitor", content: "I need to update on of my shipping labels" },
        { sender_type: "visitor", content: "?" },
      ]),
      true,
    )
  })
})
