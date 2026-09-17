import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getMetaCatalogCustomLabel2ForListing,
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

  it("ignores pickup-only boards and other sections", () => {
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
        section: "fins",
        shipping_available: true,
      }),
      undefined,
    )
  })
})
