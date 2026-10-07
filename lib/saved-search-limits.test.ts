import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { BOARD_SAVED_SEARCHES_MAX } from "./saved-search-limits.ts"

describe("BOARD_SAVED_SEARCHES_MAX", () => {
  it("lets an account keep 10 searches", () => {
    assert.equal(BOARD_SAVED_SEARCHES_MAX, 10)
  })
})
