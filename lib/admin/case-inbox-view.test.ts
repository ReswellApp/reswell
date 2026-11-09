import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { inboxViewFromSearchParams } from "./case-inbox.ts"

describe("inboxViewFromSearchParams", () => {
  it("only exposes open and resolved for the solo desk", () => {
    assert.equal(
      inboxViewFromSearchParams({
        view: null,
        status: null,
        type: null,
        assignee: null,
        tab: null,
      }).view,
      "open",
    )
    assert.equal(
      inboxViewFromSearchParams({
        view: "resolved",
        status: null,
        type: null,
        assignee: null,
        tab: null,
      }).view,
      "resolved",
    )
    assert.equal(
      inboxViewFromSearchParams({
        view: null,
        status: "resolved",
        type: "order",
        assignee: null,
        tab: null,
      }).view,
      "resolved",
    )
  })

  it("ignores multi-agent folder deep links", () => {
    for (const view of ["mine", "unassigned", "new", "waiting", "claims", "overdue", "all"]) {
      assert.equal(
        inboxViewFromSearchParams({
          view,
          status: null,
          type: null,
          assignee: null,
          tab: null,
        }).view,
        "open",
      )
    }
  })
})
