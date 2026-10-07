import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { nextSavedSearchSelection } from "./saved-search-selection.ts"

describe("nextSavedSearchSelection", () => {
  it("does not carry the first search id onto a second search", () => {
    assert.deepEqual(
      nextSavedSearchSelection(
        { criteriaKey: "first", id: "saved-1", dismissed: false },
        "second",
        null,
      ),
      { criteriaKey: "second", id: null, dismissed: false },
    )
  })

  it("keeps a just-saved search when a refresh still says it is unsaved", () => {
    const saved = { criteriaKey: "second", id: "saved-2", dismissed: false }
    assert.equal(nextSavedSearchSelection(saved, "second", null), saved)
  })

  it("does not restore a search the shopper just removed", () => {
    const removed = { criteriaKey: "second", id: null, dismissed: true }
    assert.equal(nextSavedSearchSelection(removed, "second", "saved-2"), removed)
  })

  it("adopts a server id for a search that is not locally confirmed", () => {
    assert.deepEqual(
      nextSavedSearchSelection(
        { criteriaKey: "second", id: null, dismissed: false },
        "second",
        "saved-2",
      ),
      { criteriaKey: "second", id: "saved-2", dismissed: false },
    )
  })
})
