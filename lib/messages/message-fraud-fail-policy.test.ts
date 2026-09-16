import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  applyMessageFraudReviewDecision,
  heuristicFailsClosedWhenLlmUnavailable,
} from "./message-fraud-fail-policy.ts"

describe("heuristicFailsClosedWhenLlmUnavailable", () => {
  it("fails closed on phones, email, phishing, and named payment apps", () => {
    assert.equal(heuristicFailsClosedWhenLlmUnavailable("phone_like"), true)
    assert.equal(heuristicFailsClosedWhenLlmUnavailable("phone_fragment"), true)
    assert.equal(heuristicFailsClosedWhenLlmUnavailable("email_like"), true)
    assert.equal(heuristicFailsClosedWhenLlmUnavailable("phishing_like"), true)
    assert.equal(heuristicFailsClosedWhenLlmUnavailable("off_platform_payment"), true)
  })

  it("fails open on isolated cash and evasion-only suspicion", () => {
    assert.equal(
      heuristicFailsClosedWhenLlmUnavailable("off_platform_payment", { ambiguousCash: true }),
      false,
    )
    assert.equal(heuristicFailsClosedWhenLlmUnavailable("evasion_suspect"), false)
  })
})

describe("applyMessageFraudReviewDecision", () => {
  it("blocks and confirms when the model agrees it is fraud", () => {
    const decision = applyMessageFraudReviewDecision({
      heuristic: "off_platform_payment",
      ambiguousCash: true,
      review: {
        decision: "block",
        reason_code: "off_platform_payment",
        confidence: "high",
        rationale: "Asking to be paid on Venmo.",
      },
    })
    assert.deepEqual(decision, {
      action: "block",
      reasonCode: "off_platform_payment",
      llmReviewStatus: "confirmed",
    })
  })

  it("allows a confident innocent use of a fraud word", () => {
    const decision = applyMessageFraudReviewDecision({
      heuristic: "off_platform_payment",
      ambiguousCash: true,
      review: {
        decision: "allow",
        reason_code: null,
        confidence: "high",
        rationale: "Talking about local cash pickup, not leaving the platform.",
      },
    })
    assert.deepEqual(decision, {
      action: "allow",
      reasonCode: null,
      llmReviewStatus: "dismissed",
    })
  })

  it("still blocks a clear phone when the model is weakly unsure", () => {
    const decision = applyMessageFraudReviewDecision({
      heuristic: "phone_like",
      ambiguousCash: false,
      review: {
        decision: "allow",
        reason_code: null,
        confidence: "low",
        rationale: "Might be a price.",
      },
    })
    assert.deepEqual(decision, {
      action: "block",
      reasonCode: "phone_like",
      llmReviewStatus: "pending",
    })
  })

  it("blocks phones when the model is unavailable", () => {
    const decision = applyMessageFraudReviewDecision({
      heuristic: "phone_like",
      ambiguousCash: false,
      review: null,
    })
    assert.deepEqual(decision, {
      action: "block",
      reasonCode: "phone_like",
      llmReviewStatus: "pending",
    })
  })

  it("allows ambiguous cash when the model is unavailable", () => {
    const decision = applyMessageFraudReviewDecision({
      heuristic: "off_platform_payment",
      ambiguousCash: true,
      review: null,
    })
    assert.deepEqual(decision, {
      action: "allow",
      reasonCode: null,
      llmReviewStatus: "unavailable",
    })
  })

  it("maps evasion-only blocks onto phone_like when the model omits a reason", () => {
    const decision = applyMessageFraudReviewDecision({
      heuristic: "evasion_suspect",
      ambiguousCash: false,
      review: {
        decision: "block",
        reason_code: null,
        confidence: "high",
        rationale: "Spelled-out phone number.",
      },
    })
    assert.deepEqual(decision, {
      action: "block",
      reasonCode: "phone_like",
      llmReviewStatus: "confirmed",
    })
  })
})
