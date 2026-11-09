import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { earningsHref, parseEarningsView } from "./earnings-view.ts"

describe("earnings view", () => {
  it("accepts hub destinations from the mobile earnings menu", () => {
    assert.equal(parseEarningsView("pending"), "pending")
    assert.equal(parseEarningsView("available"), "available")
    assert.equal(parseEarningsView("activity"), "activity")
    assert.equal(parseEarningsView("credit"), "credit")
  })

  it("treats unknown or empty values as the hub", () => {
    assert.equal(parseEarningsView(null), null)
    assert.equal(parseEarningsView(undefined), null)
    assert.equal(parseEarningsView("menu"), null)
    assert.equal(parseEarningsView("cashout"), null)
  })

  it("builds earnings URLs that match the hub links", () => {
    assert.equal(earningsHref(), "/dashboard/earnings")
    assert.equal(earningsHref(null), "/dashboard/earnings")
    assert.equal(earningsHref("available"), "/dashboard/earnings?view=available")
  })
})
