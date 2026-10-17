import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isListingForeignKeyDeleteError, listingArchivePatch } from "./listing-archive.ts"

const archivedAt = "2026-10-15T00:00:00.000Z"

describe("listingArchivePatch", () => {
  it("takes a live listing off the market without marking it sold", () => {
    const patch = listingArchivePatch({
      status: "active",
      archivedAt,
      reason: "seller_archive",
    })

    assert.equal(patch.status, "removed")
    assert.equal(patch.archived_at, archivedAt)
    assert.equal(patch.hidden_from_site, true)
    assert.equal(patch.site_visibility_reason, "seller_archive")
    assert.equal(patch.stock_quantity, 0)
  })

  it("keeps a sold listing sold so the sale stays on file", () => {
    const patch = listingArchivePatch({
      status: "sold",
      archivedAt,
      reason: "admin_status",
    })

    assert.equal(patch.status, undefined)
    assert.equal(patch.site_visibility_reason, "admin_status")
    assert.equal(patch.hidden_from_site, true)
  })
})

describe("isListingForeignKeyDeleteError", () => {
  it("matches the postgres restrict violation from order history", () => {
    assert.equal(isListingForeignKeyDeleteError({ code: "23503" }), true)
    assert.equal(isListingForeignKeyDeleteError({ code: "23505" }), false)
    assert.equal(isListingForeignKeyDeleteError(null), false)
  })
})
