import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  boardSavedCriteriaEquals,
  savedSearchMatchesCriteria,
} from "./saved-search-criteria-equal.ts"

describe("boardSavedCriteriaEquals", () => {
  it("treats the same marketplace query as one search", () => {
    assert.equal(
      boardSavedCriteriaEquals(
        { q: "chris", anySection: true },
        { q: "Chris", anySection: true },
      ),
      true,
    )
  })

  it("does not match a different query", () => {
    assert.equal(
      boardSavedCriteriaEquals(
        { q: "chris", anySection: true },
        { q: "christenson", anySection: true },
      ),
      false,
    )
  })

  it("ignores empty fields and list order", () => {
    assert.equal(
      boardSavedCriteriaEquals(
        { section: "surfboards", style: ["fish", "shortboard"], brand: "Album" },
        { section: "surfboards", style: ["shortboard", "fish"], brand: "Album", q: "  " },
      ),
      true,
    )
  })
})

describe("savedSearchMatchesCriteria", () => {
  it("finds a previously saved search", () => {
    assert.equal(
      savedSearchMatchesCriteria(
        [{ criteria: { q: "chris", anySection: true } }],
        { q: "chris", anySection: true },
      ),
      true,
    )
  })
})
