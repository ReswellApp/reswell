import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isLiveChatShipFromLabelUpdateIntent,
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

  it("keeps panel intent sticky across follow-ups in the thread", () => {
    assert.equal(
      threadHasLiveChatShipFromLabelUpdateIntent([
        { sender_type: "visitor", content: "I need to update on of my shipping labels" },
        { sender_type: "visitor", content: "?" },
        { sender_type: "visitor", content: "any update" },
      ]),
      true,
    )
  })
})
