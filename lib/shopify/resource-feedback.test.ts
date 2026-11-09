import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  formatShopifyFeedbackMessage,
  shopifyFeedbackMessages,
  shopifyOrderAttributionSourceName,
} from "@/lib/shopify/resource-feedback"

describe("resource-feedback helpers", () => {
  it("formats merchant-facing feedback messages", () => {
    assert.equal(
      formatShopifyFeedbackMessage("needs at least one image"),
      "Needs at least one image.",
    )
    assert.equal(
      formatShopifyFeedbackMessage("Too many variants."),
      "Too many variants.",
    )
  })

  it("dedupes and caps feedback messages", () => {
    assert.deepEqual(
      shopifyFeedbackMessages([
        "needs at least one image",
        "Needs at least one image.",
        "choose a Reswell category",
      ]),
      ["Needs at least one image.", "Choose a Reswell category."],
    )
  })

  it("builds channel attribution source names", () => {
    assert.equal(
      shopifyOrderAttributionSourceName("reswell-us-abc"),
      "channel:reswell-us-abc",
    )
    assert.equal(
      shopifyOrderAttributionSourceName("channel:reswell-us-abc"),
      "channel:reswell-us-abc",
    )
    assert.equal(shopifyOrderAttributionSourceName(null), null)
  })
})
