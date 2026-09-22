import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildAdminListingsSearchOrFilter,
  escapeAdminListingsIlikePattern,
} from "./adminListings.ts"

describe("escapeAdminListingsIlikePattern", () => {
  it("escapes ILIKE wildcards and strips quotes that would break PostgREST or()", () => {
    assert.equal(escapeAdminListingsIlikePattern("50%_off"), "50\\%\\_off")
    assert.equal(escapeAdminListingsIlikePattern('lost "shaper"'), "lost shaper")
  })
})

describe("buildAdminListingsSearchOrFilter", () => {
  it("returns none for blank search", () => {
    assert.deepEqual(buildAdminListingsSearchOrFilter("  ", []), { kind: "none" })
  })

  it("looks up a listing id when the query is a UUID", () => {
    const id = "2f1a0c8e-4b11-4d22-9f33-abcdef123456"
    assert.deepEqual(buildAdminListingsSearchOrFilter(id, ["ignored"]), {
      kind: "id",
      id,
    })
  })

  it("builds a quoted or-filter and includes matching seller ids", () => {
    const sellerId = "11111111-1111-4111-8111-111111111111"
    const result = buildAdminListingsSearchOrFilter("lost", [sellerId, "not-a-uuid"])
    assert.equal(result.kind, "or")
    if (result.kind !== "or") return
    assert.match(result.filter, /title\.ilike\."%lost%"/)
    assert.match(result.filter, /brand\.ilike\."%lost%"/)
    assert.match(result.filter, /user_id\.in\.\(11111111-1111-4111-8111-111111111111\)/)
    assert.equal(result.filter.includes("not-a-uuid"), false)
  })
})
