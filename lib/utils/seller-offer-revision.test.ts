import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  planSellerOfferRevision,
  type SellerOfferConflictRow,
} from "./seller-offer-revision.ts"

function row(
  partial: Partial<SellerOfferConflictRow> & Pick<SellerOfferConflictRow, "id">,
): SellerOfferConflictRow {
  return {
    listingId: "listing-a",
    status: "COUNTERED",
    sellerInitiated: true,
    lineItemListingIds: [],
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...partial,
  }
}

describe("planSellerOfferRevision", () => {
  it("allows a first seller offer when nothing is open", () => {
    assert.deepEqual(planSellerOfferRevision([], ["listing-a"]), { kind: "clear" })
  })

  it("replaces the newest seller-initiated offer and drops older overlaps", () => {
    const plan = planSellerOfferRevision(
      [
        row({ id: "old", updatedAt: "2026-09-01T00:00:00.000Z" }),
        row({
          id: "bundle",
          listingId: "listing-b",
          lineItemListingIds: ["listing-a"],
          updatedAt: "2026-09-02T00:00:00.000Z",
        }),
      ],
      ["listing-a"],
    )
    assert.deepEqual(plan, { kind: "replace", keepId: "bundle", dropIds: ["old"] })
  })

  it("blocks when the buyer already has an open offer on a listing", () => {
    const plan = planSellerOfferRevision(
      [row({ id: "buyer", sellerInitiated: false, status: "PENDING" })],
      ["listing-a"],
    )
    assert.deepEqual(plan, { kind: "blocked", listingId: "listing-a" })
  })

  it("ignores open offers on other listings", () => {
    const plan = planSellerOfferRevision(
      [row({ id: "other", listingId: "listing-z" })],
      ["listing-a"],
    )
    assert.deepEqual(plan, { kind: "clear" })
  })
})
