import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { inboxQueryUsesHistory } from "./case-inbox-query.ts"

describe("inboxQueryUsesHistory", () => {
  it("keeps the open queue off the history path", () => {
    assert.equal(inboxQueryUsesHistory("", "open"), false)
    assert.equal(inboxQueryUsesHistory("", "mine"), false)
    assert.equal(inboxQueryUsesHistory("", "claims"), false)
  })

  it("pages resolved, all, and any search so older tickets stay findable", () => {
    assert.equal(inboxQueryUsesHistory("", "resolved"), true)
    assert.equal(inboxQueryUsesHistory("", "all"), true)
    assert.equal(inboxQueryUsesHistory("ding", "open"), true)
  })
})
