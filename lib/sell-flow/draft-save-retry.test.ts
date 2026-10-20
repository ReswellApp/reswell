import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { draftSaveTargetsStaleListing } from "./draft-save-retry.ts"

describe("draftSaveTargetsStaleListing", () => {
  it("retries when the saved id is no longer a draft", () => {
    assert.equal(draftSaveTargetsStaleListing(409, "Listing is not a draft", true), true)
    assert.equal(draftSaveTargetsStaleListing(500, "Listing is not a draft", true), true)
    assert.equal(draftSaveTargetsStaleListing(404, "Draft not found", true), true)
  })

  it("does not retry a first save or a permission error", () => {
    assert.equal(draftSaveTargetsStaleListing(409, "Listing is not a draft", false), false)
    assert.equal(draftSaveTargetsStaleListing(403, "Forbidden", true), false)
    assert.equal(draftSaveTargetsStaleListing(400, "Invalid payload", true), false)
  })
})
