import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { planFlowReplacement } from "./flow-replacement"

describe("email studio flow replacement lineage", () => {
  it("protects the current live flow while creating a draft", () => {
    assert.deepEqual(planFlowReplacement({
      currentFlowId: "A",
      currentStatus: "live",
      protectedFlowId: null,
      protectedFlowStatus: null,
    }), {
      protectedFlowId: "A",
      protectedFlowStatus: "live",
      intermediateFlowIdToDisable: null,
    })
  })

  it("preserves A live and disables intermediate B manual before creating C", () => {
    assert.deepEqual(planFlowReplacement({
      currentFlowId: "B",
      currentStatus: "manual",
      protectedFlowId: "A",
      protectedFlowStatus: "live",
    }), {
      protectedFlowId: "A",
      protectedFlowStatus: "live",
      intermediateFlowIdToDisable: "B",
    })
  })

  it("protects the current live replacement after its predecessor was retired", () => {
    assert.deepEqual(planFlowReplacement({
      currentFlowId: "B",
      currentStatus: "live",
      protectedFlowId: null,
      protectedFlowStatus: null,
    }), {
      protectedFlowId: "B",
      protectedFlowStatus: "live",
      intermediateFlowIdToDisable: null,
    })
  })
})
