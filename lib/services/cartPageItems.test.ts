import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  keepCartPageListing,
  peerListingIdsForAcceptedOffers,
} from "@/lib/services/cartPageItems"

describe("keepCartPageListing", () => {
  it("keeps active and pending peer listings", () => {
    assert.equal(keepCartPageListing({ status: "active", section: "surfboards" }), true)
    assert.equal(keepCartPageListing({ status: "pending_sale", section: "fins" }), true)
  })

  it("keeps purchasable Reswell shop inventory", () => {
    assert.equal(keepCartPageListing({ status: "active", section: "new" }), true)
  })

  it("drops listings a buyer cannot purchase", () => {
    assert.equal(
      keepCartPageListing({ status: "active", section: "surfboards", hidden_from_site: true }),
      false,
    )
    assert.equal(
      keepCartPageListing({
        status: "active",
        section: "surfboards",
        archived_at: "2026-01-01T00:00:00.000Z",
      }),
      false,
    )
    assert.equal(keepCartPageListing({ status: "sold", section: "surfboards" }), false)
    assert.equal(
      keepCartPageListing({
        status: "active",
        section: "surfboards",
        title: "Admin Seed board",
      }),
      false,
    )
    assert.equal(keepCartPageListing({ status: "active", section: "unknown" }), false)
  })
})

describe("peerListingIdsForAcceptedOffers", () => {
  it("returns peer listing ids and skips shop inventory", () => {
    assert.deepEqual(
      peerListingIdsForAcceptedOffers([
        { id: "board", section: "surfboards" },
        { id: "shop", section: "new" },
        { id: "fin", section: "fins" },
      ]),
      ["board", "fin"],
    )
  })
})
