import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { homeFeedPlan, visibleHomeFeedSlots } from "./homeFeedPlan.ts"

describe("homepage feed plan", () => {
  it("keeps one ordered list and leaves Shop From Reswell off", () => {
    assert.deepEqual(
      homeFeedPlan.map((slot) => slot.id),
      [
        "recently_listed",
        "recently_added_fins",
        "trending_brands",
        "recently_added_surfboards",
        "recently_sold",
        "featured_shops",
        "reswell_shop",
      ],
    )
    const shop = homeFeedPlan.find((slot) => slot.id === "reswell_shop")
    assert.equal(shop?.enabled, false)
    assert.equal(shop?.title, "Shop From Reswell")
    assert.deepEqual(
      visibleHomeFeedSlots().map((slot) => slot.title),
      [
        "Recently listed",
        "Recently added fins",
        "Trending brands",
        "Recently added surfboards",
        "Recently sold surfboards",
        "Featured Sellers",
      ],
    )
  })
})
