import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getGoogleMerchantApparelProductCategory,
  getGoogleMerchantProductCategoryForSection,
  getGoogleMerchantWetsuitsProductCategory,
} from "./config.ts"

describe("Google Merchant product categories", () => {
  it("keeps wetsuits and apparel on distinct Google taxonomy IDs", () => {
    const keys = [
      "GOOGLE_MERCHANT_WETSUITS_PRODUCT_CATEGORY",
      "GOOGLE_MERCHANT_APPAREL_PRODUCT_CATEGORY",
    ] as const
    const previous = new Map(keys.map((key) => [key, process.env[key]]))
    for (const key of keys) delete process.env[key]
    try {
      assert.equal(getGoogleMerchantProductCategoryForSection("wetsuits"), "1147")
      assert.equal(getGoogleMerchantProductCategoryForSection("apparel"), "499813")
      assert.notEqual(
        getGoogleMerchantWetsuitsProductCategory(),
        getGoogleMerchantApparelProductCategory(),
      )
    } finally {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }
  })
})
