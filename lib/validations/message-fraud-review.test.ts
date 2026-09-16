import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { messageFraudReviewResultSchema } from "./message-fraud-review.ts"

describe("messageFraudReviewResultSchema", () => {
  it("accepts a compact block verdict", () => {
    const parsed = messageFraudReviewResultSchema.parse({
      decision: "block",
      reason_code: "phone_like",
      confidence: "high",
      rationale: "Spelled NANP number.",
    })
    assert.equal(parsed.decision, "block")
  })

  it("accepts an allow verdict with a null reason", () => {
    const parsed = messageFraudReviewResultSchema.parse({
      decision: "allow",
      reason_code: null,
      confidence: "medium",
      rationale: "Cash means local pickup.",
    })
    assert.equal(parsed.decision, "allow")
  })
})
