import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getMetaCatalogCustomLabel2ForListing,
  META_CATALOG_DEFAULT_GEAR_CUSTOM_LABEL,
  META_CATALOG_DEFAULT_SHIPPING_CUSTOM_LABEL,
} from "./catalog-product.ts"

describe("getMetaCatalogCustomLabel2ForListing", () => {
  it("labels surfboards that offer shipping", () => {
    assert.equal(
      getMetaCatalogCustomLabel2ForListing({
        section: "surfboards",
        shipping_available: true,
      }),
      META_CATALOG_DEFAULT_SHIPPING_CUSTOM_LABEL,
    )
  })

  it("ignores pickup-only boards and leaves wetsuits unlabeled", () => {
    assert.equal(
      getMetaCatalogCustomLabel2ForListing({
        section: "surfboards",
        shipping_available: false,
      }),
      undefined,
    )
    assert.equal(
      getMetaCatalogCustomLabel2ForListing({
        section: "surfboards",
        shipping_available: null,
      }),
      undefined,
    )
    assert.equal(
      getMetaCatalogCustomLabel2ForListing({
        section: "wetsuits",
        shipping_available: true,
      }),
      undefined,
    )
  })

  it("labels apparel, traction, bags, packs, leashes, and fins together", () => {
    for (const section of ["apparel", "traction", "boardbags", "surfpacks", "leashes", "fins"]) {
      assert.equal(
        getMetaCatalogCustomLabel2ForListing({ section, shipping_available: true }),
        META_CATALOG_DEFAULT_GEAR_CUSTOM_LABEL,
      )
    }
  })
})
