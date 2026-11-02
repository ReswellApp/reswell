import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  RESWELL_CHANNEL_SPECIFICATION_HANDLE,
  reswellMarketplaceUrl,
  shopifyAdminProductsUrl,
} from "@/lib/shopify/sales-channel"

describe("sales-channel helpers", () => {
  it("uses the Reswell US specification handle from channel_config", () => {
    assert.equal(RESWELL_CHANNEL_SPECIFICATION_HANDLE, "reswell-us")
  })

  it("builds marketplace and Shopify admin product URLs", () => {
    assert.equal(reswellMarketplaceUrl("https://www.reswell.app/"), "https://www.reswell.app")
    assert.equal(
      shopifyAdminProductsUrl("cool-boards.myshopify.com"),
      "https://admin.shopify.com/store/cool-boards/products",
    )
  })
})
