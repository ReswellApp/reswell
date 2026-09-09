import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shouldShowListingGoodDeal } from "./listing-good-deal.ts"

const activeDeal = {
  section: "surfboards",
  status: "active",
  is_good_deal: true,
}

describe("shouldShowListingGoodDeal", () => {
  it("shows an admin-marked active surfboard", () => {
    assert.equal(shouldShowListingGoodDeal(activeDeal), true)
  })

  it("continues to show while the listing remains purchasable pending sale", () => {
    assert.equal(shouldShowListingGoodDeal({ ...activeDeal, status: "pending_sale" }), true)
  })

  it("does not show on unavailable statuses", () => {
    for (const status of ["sold", "draft", "removed", "pending"]) {
      assert.equal(shouldShowListingGoodDeal({ ...activeDeal, status }), false)
    }
  })

  it("does not show for another marketplace section", () => {
    assert.equal(shouldShowListingGoodDeal({ ...activeDeal, section: "fins" }), false)
  })

  it("does not show when hidden or archived", () => {
    assert.equal(shouldShowListingGoodDeal({ ...activeDeal, hidden_from_site: true }), false)
    assert.equal(
      shouldShowListingGoodDeal({ ...activeDeal, archived_at: "2026-09-09T00:00:00Z" }),
      false,
    )
  })

  it("requires the editorial flag", () => {
    assert.equal(shouldShowListingGoodDeal({ ...activeDeal, is_good_deal: false }), false)
    assert.equal(
      shouldShowListingGoodDeal({
        section: "surfboards",
        status: "active",
      }),
      false,
    )
  })
})
