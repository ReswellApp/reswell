import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { resolveBoardSellCreateViewMode } from "./resolve-board-sell-create-view-mode.ts"

describe("resolveBoardSellCreateViewMode", () => {
  it("sends first-time giveaway sellers to Quick list", () => {
    assert.equal(
      resolveBoardSellCreateViewMode({
        fromGiveaway: true,
        hasPublishedSurfboard: false,
      }),
      "quick",
    )
  })

  it("keeps returning surfboard sellers on Guided, even from a giveaway", () => {
    assert.equal(
      resolveBoardSellCreateViewMode({
        fromGiveaway: true,
        hasPublishedSurfboard: true,
      }),
      "guided",
    )
  })

  it("honors a stored mode for returning sellers", () => {
    assert.equal(
      resolveBoardSellCreateViewMode({
        fromGiveaway: true,
        hasPublishedSurfboard: true,
        storedMode: "advanced",
      }),
      "advanced",
    )
  })

  it("keeps catalog handoffs on Guided", () => {
    assert.equal(
      resolveBoardSellCreateViewMode({
        fromGiveaway: true,
        hasPublishedSurfboard: false,
        catalogHandoff: true,
      }),
      "guided",
    )
  })

  it("defaults regular create traffic to Guided", () => {
    assert.equal(
      resolveBoardSellCreateViewMode({
        fromGiveaway: false,
        hasPublishedSurfboard: false,
      }),
      "guided",
    )
  })
})
