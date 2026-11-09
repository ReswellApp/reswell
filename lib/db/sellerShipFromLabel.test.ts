import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { formatSellerProfileForShipEngineShipFrom } from "./sellerShipFromLabel.ts"

describe("formatSellerProfileForShipEngineShipFrom", () => {
  it("prints the seller-chosen label name instead of the legal or display name", () => {
    assert.equal(
      formatSellerProfileForShipEngineShipFrom({
        display_name: "Jordan Blake",
        shop_name: "Jordan Blake",
        is_shop: true,
        shipping_label_name: "ELUDE",
      }),
      "ELUDE",
    )
  })

  it("falls back to the shop name, then the public display name", () => {
    assert.equal(
      formatSellerProfileForShipEngineShipFrom({
        display_name: "Jordan Blake",
        shop_name: "ELUDE",
        is_shop: true,
        shipping_label_name: "  ",
      }),
      "ELUDE",
    )
    assert.equal(
      formatSellerProfileForShipEngineShipFrom({
        display_name: "Jordan Blake",
        shop_name: "ELUDE",
        is_shop: false,
        shipping_label_name: null,
      }),
      "Jordan Blake",
    )
  })
})
