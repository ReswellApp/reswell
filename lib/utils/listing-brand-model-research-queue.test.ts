import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { unmatchedResearchCooldownOrFilter } from "./listing-brand-model-research-queue.ts"

describe("unmatchedResearchCooldownOrFilter", () => {
  it("includes never-researched rows and those older than the cutoff", () => {
    const cutoff = "2026-09-07T20:15:00.000Z"
    assert.equal(
      unmatchedResearchCooldownOrFilter(cutoff),
      `last_researched_at.is.null,last_researched_at.lt."${cutoff}"`,
    )
  })
})
