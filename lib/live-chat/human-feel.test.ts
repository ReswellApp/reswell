import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LIVE_CHAT_HUMAN_FEEL_HOLD_CAP_MS,
  LIVE_CHAT_PERSONAS,
  isLiveChatJoinMessage,
  liveChatAskNeedsLookup,
  liveChatHoldAfterGenerationMs,
  liveChatHumanFeelDelay,
  liveChatJoinMessage,
  liveChatPersonaAlreadyJoined,
  liveChatPersonaVoiceNote,
  liveChatTypingLabel,
  pickLiveChatPersonaId,
  readLiveChatPersonaFromMetadata,
  resolveLiveChatPersona,
} from "./human-feel.ts"

describe("live chat human-feel persona", () => {
  it("is sticky from metadata and otherwise hashes the session", () => {
    assert.equal(readLiveChatPersonaFromMetadata({ persona: "david" })?.id, "david")
    assert.equal(resolveLiveChatPersona("any", { persona: "david" }).firstName, "David")
    assert.equal(resolveLiveChatPersona("any", { persona: "hayden" }).id, "hayden")

    const a = pickLiveChatPersonaId("session-stable")
    const b = pickLiveChatPersonaId("session-stable")
    assert.equal(a, b)
    assert.ok(a === "hayden" || a === "david")

    let hayden = 0
    for (let i = 0; i < 100; i += 1) {
      if (pickLiveChatPersonaId(`thread-${i}`) === "hayden") hayden += 1
    }
    assert.ok(hayden >= 55 && hayden <= 85, `expected ~70 Hayden, got ${hayden}`)
  })

  it("writes the founder join line and typing label", () => {
    assert.equal(liveChatJoinMessage("Hayden"), "Hayden joined the chat")
    assert.equal(liveChatJoinMessage("David"), "David joined the chat")
    assert.equal(isLiveChatJoinMessage("Hayden joined the chat"), true)
    assert.equal(isLiveChatJoinMessage("David joined the chat"), true)
    assert.equal(isLiveChatJoinMessage("Reswell Team joined the chat"), false)
    assert.equal(liveChatTypingLabel("Hayden"), "Hayden is typing…")
    assert.equal(LIVE_CHAT_PERSONAS.hayden.fullName, "Hayden Garfield")
    assert.equal(LIVE_CHAT_PERSONAS.david.fullName, "David Kalt")
  })

  it("treats persona_joined_at as join-once", () => {
    assert.equal(liveChatPersonaAlreadyJoined({}), false)
    assert.equal(liveChatPersonaAlreadyJoined({ persona_joined_at: "2026-09-19T00:00:00.000Z" }), true)
  })
})

describe("live chat human-feel delay", () => {
  it("clamps read / think / type and adds a first-join walk-over", () => {
    const first = liveChatHumanFeelDelay({
      sessionId: "delay-session",
      visitorChars: 40,
      replyChars: 80,
      isFirstJoin: true,
      needsLookup: false,
    })
    assert.ok(first.readMs >= 500 && first.readMs <= 1800)
    assert.ok(first.thinkMs >= 600 && first.thinkMs <= 2200)
    assert.ok(first.typeMs >= 900 && first.typeMs <= 4500)
    assert.ok(first.walkOverMs >= 600 && first.walkOverMs <= 1100)
    assert.equal(first.totalMs, first.readMs + first.thinkMs + first.typeMs + first.walkOverMs)

    const follow = liveChatHumanFeelDelay({
      sessionId: "delay-session",
      visitorChars: 40,
      replyChars: 80,
      isFirstJoin: false,
      needsLookup: false,
    })
    assert.equal(follow.walkOverMs, 0)
    assert.ok(follow.totalMs < first.totalMs)
  })

  it("is deterministic for the same session and ask", () => {
    const args = {
      sessionId: "same-thread",
      visitorChars: 24,
      replyChars: 60,
      isFirstJoin: true,
      needsLookup: true,
    }
    assert.deepEqual(liveChatHumanFeelDelay(args), liveChatHumanFeelDelay(args))
  })

  it("holds only the leftover delay after generation, capped at 12s", () => {
    assert.equal(
      liveChatHoldAfterGenerationMs({ elapsedMs: 1_000, targetMs: 5_000 }),
      4_000,
    )
    assert.equal(liveChatHoldAfterGenerationMs({ elapsedMs: 8_000, targetMs: 5_000 }), 0)
    assert.equal(
      liveChatHoldAfterGenerationMs({ elapsedMs: 0, targetMs: 40_000 }),
      LIVE_CHAT_HUMAN_FEEL_HOLD_CAP_MS,
    )
  })

  it("flags order-like asks as needing a lookup", () => {
    assert.equal(liveChatAskNeedsLookup("how do I buy a surfboard on Reswell?"), false)
    assert.equal(liveChatAskNeedsLookup("Where is my order?"), true)
    assert.equal(liveChatAskNeedsLookup("Can you update the shipping label?"), true)
  })
})

describe("live chat persona voice", () => {
  it("tells the writer they are Hayden or David, not a bot", () => {
    const note = liveChatPersonaVoiceNote("Hayden")
    assert.match(note, /You are Hayden/)
    assert.match(note, /Never say you are an AI/)
    assert.match(note, /Reswell Team/)
    assert.match(note, /1–3 sentences/)
    assert.match(note, /anything there/)
    assert.match(note, /marketplace how-tos/i)
    assert.match(note, /order number/)
  })
})
