import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { listAdminSupportInboxQuerySchema } from "./adminSupportInbox.ts"

describe("listAdminSupportInboxQuerySchema", () => {
  it("defaults to the open queue page", () => {
    const parsed = listAdminSupportInboxQuerySchema.parse({})
    assert.equal(parsed.view, "open")
    assert.equal(parsed.search, "")
    assert.equal(parsed.offset, 0)
    assert.equal(parsed.limit, 50)
  })

  it("accepts a history search", () => {
    const parsed = listAdminSupportInboxQuerySchema.parse({
      view: "resolved",
      search: "ding on the rail",
      offset: 50,
    })
    assert.equal(parsed.view, "resolved")
    assert.equal(parsed.search, "ding on the rail")
    assert.equal(parsed.offset, 50)
  })
})
