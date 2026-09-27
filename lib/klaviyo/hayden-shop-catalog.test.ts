import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  KLAVIYO_HAYDEN_SHOP_CATEGORY,
  klaviyoHaydenShopCategoryForListing,
} from "./hayden-shop-catalog.ts"

const HAYDEN_ID = "ab98fbb1-0c49-49e1-9483-a1c4a286c8e2"

describe("klaviyoHaydenShopCategoryForListing", () => {
  it("tags Hayden's surfboards", () => {
    assert.equal(
      klaviyoHaydenShopCategoryForListing(
        { user_id: HAYDEN_ID, section: "surfboards" },
        HAYDEN_ID,
      ),
      KLAVIYO_HAYDEN_SHOP_CATEGORY,
    )
  })

  it("does not tag another seller", () => {
    assert.equal(
      klaviyoHaydenShopCategoryForListing(
        { user_id: "11111111-1111-4111-8111-111111111111", section: "surfboards" },
        HAYDEN_ID,
      ),
      null,
    )
  })

  it("does not tag Hayden's non-board listings", () => {
    assert.equal(
      klaviyoHaydenShopCategoryForListing({ user_id: HAYDEN_ID, section: "fins" }, HAYDEN_ID),
      null,
    )
  })

  it("skips the category when the seller id is unknown", () => {
    assert.equal(
      klaviyoHaydenShopCategoryForListing(
        { user_id: HAYDEN_ID, section: "surfboards" },
        null,
      ),
      null,
    )
  })
})
