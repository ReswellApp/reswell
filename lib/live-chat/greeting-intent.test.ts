import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isLiveChatPresenceIntent,
  normalizeLiveChatVisitorText,
} from "./greeting-intent.ts"

describe("live chat presence intent", () => {
  it("treats hi there and presence pings as checking if someone is here", () => {
    for (const text of [
      "hi there",
      "Hi there!",
      "hey there",
      "hello",
      "hi",
      "you there?",
      "anyone there?",
      "anything there?",
      "hi there. anything there?",
      "hey is anyone there",
      "is someone around",
    ]) {
      assert.equal(isLiveChatPresenceIntent(text), true, text)
    }
  })

  it("does not treat a hello plus a real ask as presence-only", () => {
    assert.equal(isLiveChatPresenceIntent("hi there. i sold a board. how do i get my money?"), false)
    assert.equal(isLiveChatPresenceIntent("how do I buy a surfboard on Reswell?"), false)
    assert.equal(isLiveChatPresenceIntent("Where is my order?"), false)
    assert.equal(isLiveChatPresenceIntent("thanks"), false)
  })

  it("strips punctuation and emoji before matching", () => {
    assert.equal(normalizeLiveChatVisitorText("Hi there! 👋"), "hi there")
    assert.equal(isLiveChatPresenceIntent("Hi there. anything there??"), true)
  })
})
