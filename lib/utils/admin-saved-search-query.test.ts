import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildAdminSavedSearchOrFilter,
  parseAdminSavedSearchFilters,
  sanitizeAdminSavedSearchQuery,
} from "./admin-saved-search-query.ts"

describe("admin saved search query", () => {
  it("strips filter metacharacters and collapses whitespace", () => {
    assert.equal(sanitizeAdminSavedSearchQuery('  lost%_board, "x"  '), "lost board x")
  })

  it("defaults unknown filters", () => {
    const filters = parseAdminSavedSearchFilters({
      q: "channel islands",
      page: "0",
      kind: "nope",
      section: "shoes",
    })
    assert.deepEqual(filters, {
      query: "channel islands",
      page: 1,
      kind: "all",
      section: "all",
    })
  })

  it("keeps alert and section filters", () => {
    const filters = parseAdminSavedSearchFilters({
      page: "3",
      kind: "alerts",
      section: "fins",
    })
    assert.equal(filters.page, 3)
    assert.equal(filters.kind, "alerts")
    assert.equal(filters.section, "fins")
  })

  it("quotes search text and includes matching account ids", () => {
    const filter = buildAdminSavedSearchOrFilter("lost@boards.com", [
      "11111111-1111-4111-8111-111111111111",
      "not-a-uuid",
    ])
    assert.ok(filter)
    assert.match(filter, /label\.ilike\."%lost@boards\.com%"/)
    assert.match(filter, /criteria->>brand\.ilike\."%lost@boards\.com%"/)
    assert.match(filter, /user_id\.in\.\(11111111-1111-4111-8111-111111111111\)/)
    assert.doesNotMatch(filter, /not-a-uuid/)
  })

  it("returns null when there is nothing to match", () => {
    assert.equal(buildAdminSavedSearchOrFilter("  ", []), null)
  })
})
