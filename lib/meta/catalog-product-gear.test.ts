import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getMetaCatalogApparelGoogleProductCategory,
  getMetaCatalogBoardbagsGoogleProductCategory,
  getMetaCatalogFinsGoogleProductCategory,
  getMetaCatalogGearSectionCustomLabel,
  getMetaCatalogGoogleProductCategoryForSection,
  getMetaCatalogHaydenShopCustomLabel,
  getMetaCatalogLeashesGoogleProductCategory,
  getMetaCatalogOutSurfingShopCustomLabel,
  getMetaCatalogSurfpacksGoogleProductCategory,
  getMetaCatalogTractionGoogleProductCategory,
  isMetaCatalogEligibleListing,
  isMetaCatalogGearSection,
  listingToMetaCatalogFeedItem,
  META_CATALOG_GEAR_SECTIONS,
  type MetaCatalogFeedContext,
  type MetaListingProductSource,
} from "./catalog-product.ts"

const GEAR_CONTEXT: MetaCatalogFeedContext = {
  haydenShopUserId: "user-hayden",
  outSurfingShopUserId: "user-outsurfing",
  brownstoneShopUserId: "user-brownstone",
  allowedSections: META_CATALOG_GEAR_SECTIONS,
  sectionAsCustomLabel0: true,
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

describe("gear catalog sections", () => {
  it("labels each gear section for product sets", () => {
    assert.equal(getMetaCatalogGearSectionCustomLabel("apparel"), "Apparel")
    assert.equal(getMetaCatalogGearSectionCustomLabel("traction"), "Traction")
    assert.equal(getMetaCatalogGearSectionCustomLabel("boardbags"), "Boardbags")
    assert.equal(getMetaCatalogGearSectionCustomLabel("surfpacks"), "Surfpacks")
    assert.equal(getMetaCatalogGearSectionCustomLabel("leashes"), "Leashes")
    assert.equal(getMetaCatalogGearSectionCustomLabel("fins"), "Fins")
    assert.equal(getMetaCatalogGearSectionCustomLabel("surfboards"), undefined)
    assert.equal(isMetaCatalogGearSection("boardbags"), true)
    assert.equal(isMetaCatalogGearSection("wetsuits"), false)
  })

  it("maps gear sections to their Google product categories", () => {
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
      getMetaCatalogGoogleProductCategoryForSection("fins"),
      getMetaCatalogFinsGoogleProductCategory(),
    )
    assert.equal(
      getMetaCatalogGoogleProductCategoryForSection("apparel"),
      getMetaCatalogApparelGoogleProductCategory(),
    )
  })

  it("uses the taxonomy leaf ids when overrides are unset", () => {
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
  })
})

describe("gear catalog feed items", () => {
  it("keeps board bags, surfpacks, and leashes off the main feed", () => {
    assert.equal(isMetaCatalogEligibleListing(gearListing({ section: "boardbags" })), false)
    assert.equal(isMetaCatalogEligibleListing(gearListing({ section: "surfpacks" })), false)
    assert.equal(isMetaCatalogEligibleListing(gearListing({ section: "leashes" })), false)
    assert.equal(listingToMetaCatalogFeedItem(gearListing()), null)
  })

  it("writes the section on custom_label_0 and keeps the city label", () => {
    const item = listingToMetaCatalogFeedItem(gearListing(), GEAR_CONTEXT)
    assert.ok(item)
    assert.equal(item.custom_label_0, "Leashes")
    assert.equal(item.custom_label_1, "SantaBarbara")
    assert.equal(item.custom_label_2, undefined)
    assert.equal(item.google_product_category, getMetaCatalogLeashesGoogleProductCategory())
    assert.equal(item.availability, "in stock")
  })

  it("moves a known shop onto custom_label_2", () => {
    const item = listingToMetaCatalogFeedItem(
      gearListing({ section: "fins", user_id: "user-hayden", title: "Twin set" }),
      GEAR_CONTEXT,
    )
    assert.ok(item)
    assert.equal(item.custom_label_0, "Fins")
    assert.equal(item.custom_label_2, getMetaCatalogHaydenShopCustomLabel())
    assert.equal(item.google_product_category, getMetaCatalogFinsGoogleProductCategory())
  })

  it("leaves shop on custom_label_0 for the main feed", () => {
    const item = listingToMetaCatalogFeedItem(
      gearListing({
        section: "apparel",
        user_id: "user-outsurfing",
        title: "Boardshorts",
      }),
      {
        haydenShopUserId: "user-hayden",
        outSurfingShopUserId: "user-outsurfing",
        brownstoneShopUserId: "user-brownstone",
      },
    )
    assert.ok(item)
    assert.equal(item.custom_label_0, getMetaCatalogOutSurfingShopCustomLabel())
    assert.equal(item.custom_label_2, undefined)
    assert.equal(item.google_product_category, getMetaCatalogApparelGoogleProductCategory())
  })

  it("rejects surfboards on the gear feed", () => {
    const item = listingToMetaCatalogFeedItem(
      gearListing({ section: "surfboards", title: "Shortboard" }),
      GEAR_CONTEXT,
    )
    assert.equal(item, null)
  })
})
