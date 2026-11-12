import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { WORKFORCE_AGENT_CATALOG, isWorkforceAgentId } from "@/lib/workforce-agents/catalog"
import { WORKFORCE_AGENT_RUNNERS } from "@/lib/workforce-agents/runners"
import { WORKFORCE_AGENT_IDS } from "@/lib/workforce-agents/types"

describe("workforce agent catalog", () => {
  it("covers every agent id exactly once", () => {
    assert.equal(WORKFORCE_AGENT_CATALOG.length, WORKFORCE_AGENT_IDS.length)
    const ids = WORKFORCE_AGENT_CATALOG.map((agent) => agent.id)
    assert.deepEqual([...ids].sort(), [...WORKFORCE_AGENT_IDS].sort())
  })

  it("has a runner for every agent", () => {
    for (const id of WORKFORCE_AGENT_IDS) {
      assert.equal(typeof WORKFORCE_AGENT_RUNNERS[id], "function")
      assert.equal(isWorkforceAgentId(id), true)
    }
  })
})
