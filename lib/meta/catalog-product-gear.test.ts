import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getMetaCatalogApparelGoogleProductCategory,
  getMetaCatalogBoardbagsGoogleProductCategory,
  getMetaCatalogFinsGoogleProductCategory,
  getMetaCatalogGearCustomLabel,
  getMetaCatalogShippingCustomLabel,
  getMetaCatalogGoogleProductCategoryForSection,
  getMetaCatalogHaydenShopCustomLabel,
  getMetaCatalogLeashesGoogleProductCategory,
  getMetaCatalogSurfpacksGoogleProductCategory,
  getMetaCatalogTractionGoogleProductCategory,
  isMetaCatalogEligibleListing,
  listingToMetaCatalogFeedItem,
  type MetaCatalogFeedContext,
  type MetaListingProductSource,
} from "./catalog-product.ts"

const SHOP_CONTEXT: MetaCatalogFeedContext = {
  haydenShopUserId: "user-hayden",
  outSurfingShopUserId: "user-outsurfing",
  brownstoneShopUserId: "user-brownstone",
}

function gearListing(
  overrides: Partial<MetaListingProductSource> = {},
): MetaListingProductSource {
  return {
    id: "listing-gear-1",
    user_id: "someone-else",
    slug: "used-leash",
    title: "6ft leash",
    description: "Clean leash",
    price: "25",
    section: "leashes",
    status: "active",
    hidden_from_site: false,
    brand: "FCS",
    condition: "used",
    city: "Santa Barbara",
    state: "CA",
    listing_images: [{ url: "/media/listings/leash.jpg", is_primary: true }],
    ...overrides,
  }
}

describe("gear rows on the main catalog feed", () => {
  it("includes board bags, surfpacks, and leashes", () => {
    assert.equal(isMetaCatalogEligibleListing(gearListing({ section: "boardbags" })), true)
    assert.equal(isMetaCatalogEligibleListing(gearListing({ section: "surfpacks" })), true)
    assert.equal(isMetaCatalogEligibleListing(gearListing({ section: "leashes" })), true)
  })

  it("shares custom_label_2 and keeps the shop on custom_label_0", () => {
    const item = listingToMetaCatalogFeedItem(
      gearListing({ section: "fins", user_id: "user-hayden", title: "Twin set" }),
      SHOP_CONTEXT,
    )
    assert.ok(item)
    assert.equal(item.custom_label_0, getMetaCatalogHaydenShopCustomLabel())
    assert.equal(item.custom_label_1, "SantaBarbara")
    assert.equal(item.custom_label_2, getMetaCatalogGearCustomLabel())
    assert.equal(item.google_product_category, getMetaCatalogFinsGoogleProductCategory())
  })

  it("maps each gear section to its Google category", () => {
    const keys = [
      "META_CATALOG_TRACTION_GOOGLE_PRODUCT_CATEGORY",
      "META_CATALOG_BOARDBAGS_GOOGLE_PRODUCT_CATEGORY",
      "META_CATALOG_LEASHES_GOOGLE_PRODUCT_CATEGORY",
      "META_CATALOG_SURFPACKS_GOOGLE_PRODUCT_CATEGORY",
      "META_CATALOG_FINS_GOOGLE_PRODUCT_CATEGORY",
      "META_CATALOG_APPAREL_GOOGLE_PRODUCT_CATEGORY",
    ] as const
    const previous = new Map(keys.map((key) => [key, process.env[key]]))
    for (const key of keys) delete process.env[key]
    try {
      assert.equal(getMetaCatalogGoogleProductCategoryForSection("traction"), "3762")
      assert.equal(getMetaCatalogGoogleProductCategoryForSection("boardbags"), "3579")
      assert.equal(getMetaCatalogGoogleProductCategoryForSection("leashes"), "3649")
      assert.equal(getMetaCatalogGoogleProductCategoryForSection("surfpacks"), "100")
      assert.equal(getMetaCatalogGoogleProductCategoryForSection("fins"), "3525")
      assert.equal(getMetaCatalogGoogleProductCategoryForSection("apparel"), "499813")
    } finally {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }

    assert.equal(
      getMetaCatalogGoogleProductCategoryForSection("traction"),
      getMetaCatalogTractionGoogleProductCategory(),
    )
    assert.equal(
      getMetaCatalogGoogleProductCategoryForSection("boardbags"),
      getMetaCatalogBoardbagsGoogleProductCategory(),
    )
    assert.equal(
      getMetaCatalogGoogleProductCategoryForSection("leashes"),
      getMetaCatalogLeashesGoogleProductCategory(),
    )
    assert.equal(
      getMetaCatalogGoogleProductCategoryForSection("surfpacks"),
      getMetaCatalogSurfpacksGoogleProductCategory(),
    )
    assert.equal(
      getMetaCatalogGoogleProductCategoryForSection("apparel"),
      getMetaCatalogApparelGoogleProductCategory(),
    )
  })

  it("does not mark a shipping surfboard as gear", () => {
    const item = listingToMetaCatalogFeedItem(
      gearListing({
        section: "surfboards",
        title: "Shortboard",
        shipping_available: true,
      }),
    )
    assert.ok(item)
    assert.equal(item.custom_label_2, getMetaCatalogShippingCustomLabel())
  })
})
