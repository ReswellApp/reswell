import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  listingAdminBarCanLinkCatalog,
  listingAdminBarShouldMount,
  listingAdminBarSnapshotFromRow,
} from "./listing-detail-admin-bar.ts"

describe("listingAdminBarShouldMount", () => {
  it("shows only for signed-in admins on the live PDP", () => {
    assert.equal(listingAdminBarShouldMount({ anonymousPublicView: false, isAdmin: true }), true)
    assert.equal(listingAdminBarShouldMount({ anonymousPublicView: true, isAdmin: true }), false)
    assert.equal(listingAdminBarShouldMount({ anonymousPublicView: false, isAdmin: false }), false)
  })
})

describe("listingAdminBarCanLinkCatalog", () => {
  it("allows surfboards and fins only", () => {
    assert.equal(listingAdminBarCanLinkCatalog("surfboards"), true)
    assert.equal(listingAdminBarCanLinkCatalog("fins"), true)
    assert.equal(listingAdminBarCanLinkCatalog("wetsuits"), false)
    assert.equal(listingAdminBarCanLinkCatalog("new"), false)
  })
})

describe("listingAdminBarSnapshotFromRow", () => {
  it("returns null when required ids are missing", () => {
    assert.equal(listingAdminBarSnapshotFromRow({ title: "Board" }), null)
    assert.equal(listingAdminBarSnapshotFromRow({ id: "a", section: "surfboards" }), null)
  })

  it("reads visibility flags and seller name from the PDP row", () => {
    const snapshot = listingAdminBarSnapshotFromRow({
      id: "listing-1",
      slug: "lotus",
      title: "Lotus",
      section: "surfboards",
      status: "active",
      hidden_from_site: true,
      hidden_from_homepage: true,
      suppressed_on_boards_browse: true,
      is_good_deal: true,
      user_id: "seller-1",
      brand_id: "brand-1",
      brand_model_id: "model-1",
      brand: "Xanadu",
      model: "Lotus",
      profiles: { shop_name: "Mike Shop", display_name: "mike12" },
    })
    assert.ok(snapshot)
    assert.equal(snapshot.hiddenFromSite, true)
    assert.equal(snapshot.sellerDisplayName, "Mike Shop")
    assert.equal(snapshot.brandLabel, "Xanadu")
    assert.equal(snapshot.modelLabel, "Lotus")
  })
})
