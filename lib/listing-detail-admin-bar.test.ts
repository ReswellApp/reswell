import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  listingAdminBarCanLinkCatalog,
  listingAdminBarCanSearchTag,
  listingAdminBarCartHoldersLabel,
  listingAdminBarShouldMount,
  listingAdminBarSnapshotFromRow,
  listingAdminCartHolderDisplayName,
  listingAdminCartHolderFromSource,
} from "./listing-detail-admin-bar.ts"

describe("listingAdminBarShouldMount", () => {
  it("shows only for signed-in admins on the live PDP", () => {
    assert.equal(listingAdminBarShouldMount({ anonymousPublicView: false, isAdmin: true }), true)
    assert.equal(listingAdminBarShouldMount({ anonymousPublicView: true, isAdmin: true }), false)
    assert.equal(listingAdminBarShouldMount({ anonymousPublicView: false, isAdmin: false }), false)
  })
})

describe("listingAdminBarCanSearchTag", () => {
  it("allows surfboards only", () => {
    assert.equal(listingAdminBarCanSearchTag("surfboards"), true)
    assert.equal(listingAdminBarCanSearchTag("fins"), false)
    assert.equal(listingAdminBarCanSearchTag("wetsuits"), false)
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
      search_tags: ["fish"],
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
    assert.deepEqual(snapshot.searchTags, ["fish"])
  })
})

describe("listingAdminBarCartHoldersLabel", () => {
  it("names the cart count for the admin bar button", () => {
    assert.equal(listingAdminBarCartHoldersLabel(0), "Cart")
    assert.equal(listingAdminBarCartHoldersLabel(1), "1 in cart")
    assert.equal(listingAdminBarCartHoldersLabel(3), "3 in cart")
  })
})

describe("listingAdminCartHolderDisplayName", () => {
  it("prefers shop name, then display name, then email", () => {
    assert.equal(
      listingAdminCartHolderDisplayName({
        isShop: true,
        shopName: "Otter Surf",
        displayName: "kai",
        email: "kai@example.com",
      }),
      "Otter Surf",
    )
    assert.equal(
      listingAdminCartHolderDisplayName({
        isShop: false,
        shopName: "Otter Surf",
        displayName: "kai",
        email: "kai@example.com",
      }),
      "kai",
    )
    assert.equal(
      listingAdminCartHolderDisplayName({
        displayName: "  ",
        email: "kai@example.com",
      }),
      "kai@example.com",
    )
    assert.equal(listingAdminCartHolderDisplayName({}), "Member")
  })
})

describe("listingAdminCartHolderFromSource", () => {
  it("returns null without a profile id", () => {
    assert.equal(listingAdminCartHolderFromSource({ profileId: "  " }), null)
  })

  it("maps cart row fields for the admin bar", () => {
    const holder = listingAdminCartHolderFromSource({
      profileId: "buyer-1",
      quantity: "2",
      addedAt: "2026-09-19T12:00:00.000Z",
      isShop: false,
      displayName: "Kai",
      email: "kai@example.com",
      avatarUrl: "https://cdn.example/kai.jpg",
    })
    assert.ok(holder)
    assert.equal(holder.userId, "buyer-1")
    assert.equal(holder.displayName, "Kai")
    assert.equal(holder.email, "kai@example.com")
    assert.equal(holder.quantity, 2)
    assert.equal(holder.addedAt, "2026-09-19T12:00:00.000Z")
    assert.equal(holder.avatarUrl, "https://cdn.example/kai.jpg")
  })
})
