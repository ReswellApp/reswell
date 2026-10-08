import assert from "node:assert/strict"
import test from "node:test"

import {
  surfboardCapErrorForAddedListing,
  type CartSurfboardCapRow,
} from "@/lib/surfboard-multi-board-parcel"

const sellerId = "hayden-shop"
const adding = { listingId: "lane-splitter", userId: sellerId, section: "surfboards" }

function board(
  listingId: string,
  status: string,
  userId = sellerId,
): CartSurfboardCapRow {
  return {
    listingId,
    userId,
    section: "surfboards",
    status,
    hiddenFromSite: false,
    archivedAt: null,
  }
}

test("an empty cart can add a surfboard", () => {
  assert.equal(surfboardCapErrorForAddedListing([], adding), null)
})

test("sold boards left in the cart do not count toward the cap", () => {
  const rows = ["a", "b", "c", "d"].map((id) => board(id, "sold"))
  assert.equal(surfboardCapErrorForAddedListing(rows, adding), null)
})

test("two purchasable boards plus sold leftovers still leave room", () => {
  const rows = [
    board("live-1", "active"),
    board("live-2", "pending_sale"),
    board("old-1", "sold"),
    board("old-2", "sold"),
    board("old-3", "sold"),
  ]
  assert.equal(surfboardCapErrorForAddedListing(rows, adding), null)
})

test("three purchasable boards from the same seller block a fourth", () => {
  const rows = ["live-1", "live-2", "live-3"].map((id) => board(id, "active"))
  const error = surfboardCapErrorForAddedListing(rows, adding)
  assert.equal(
    error,
    "You can buy up to 3 surfboards from the same seller in one checkout.",
  )
})

test("boards from another seller do not count", () => {
  const rows = ["a", "b", "c", "d"].map((id) => board(id, "active", "other-shop"))
  assert.equal(surfboardCapErrorForAddedListing(rows, adding), null)
})

test("hidden and archived boards do not count", () => {
  const rows: CartSurfboardCapRow[] = [
    { ...board("hidden", "active"), hiddenFromSite: true },
    { ...board("archived", "active"), archivedAt: "2026-01-01T00:00:00.000Z" },
    board("live", "active"),
  ]
  assert.equal(surfboardCapErrorForAddedListing(rows, adding), null)
})

test("a surfboard already in the cart is not counted again", () => {
  const rows = [
    board("live-1", "active"),
    board("live-2", "active"),
    board("live-3", "active"),
    board(adding.listingId, "active"),
  ]
  assert.equal(surfboardCapErrorForAddedListing(rows, adding), null)
})

test("non-surfboard sections skip the cap", () => {
  const rows = ["a", "b", "c", "d"].map((id) => board(id, "active"))
  assert.equal(
    surfboardCapErrorForAddedListing(rows, { ...adding, section: "fins" }),
    null,
  )
})
