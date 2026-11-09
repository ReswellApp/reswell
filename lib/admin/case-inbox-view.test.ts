import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { inboxViewFromSearchParams, isCaseInboxView } from "./case-inbox.ts"

describe("inboxViewFromSearchParams", () => {
  it("accepts every Intercom-style folder view", () => {
    for (const view of [
      "open",
      "mine",
      "unassigned",
      "new",
      "waiting",
      "claims",
      "overdue",
      "resolved",
      "all",
    ] as const) {
      assert.equal(isCaseInboxView(view), true)
      assert.equal(
        inboxViewFromSearchParams({
          view,
          status: null,
          type: null,
          assignee: null,
          tab: null,
        }).view,
        view,
      )
    }
  })

  it("keeps legacy status and assignee query params working", () => {
    assert.equal(
      inboxViewFromSearchParams({
        view: null,
        status: "waiting",
        type: null,
        assignee: null,
        tab: null,
      }).view,
      "waiting",
    )
    assert.equal(
      inboxViewFromSearchParams({
        view: null,
        status: null,
        type: null,
        assignee: "mine",
        tab: null,
      }).view,
      "mine",
    )
    assert.equal(
      inboxViewFromSearchParams({
        view: null,
        status: null,
        type: "claims",
        assignee: null,
        tab: null,
      }).view,
      "claims",
    )
  })

  it("defaults unknown views to open", () => {
    assert.equal(
      inboxViewFromSearchParams({
        view: "mentions",
        status: null,
        type: "order",
        assignee: null,
        tab: null,
      }).view,
      "open",
    )
  })
})
