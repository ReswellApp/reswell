import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  SURFBOARD_MIN_PRICE_MESSAGE,
  SURFBOARD_OFFER_MIN_MESSAGE,
  liveSurfboardPriceWriteError,
  surfboardMinPriceError,
  surfboardOfferAmountError,
  surfboardPriceDropFloorError,
} from "./listing-price-bounds.ts"

describe("surfboardMinPriceError", () => {
  it("rejects prices under $50 and accepts $50", () => {
    assert.equal(surfboardMinPriceError(49.99), SURFBOARD_MIN_PRICE_MESSAGE)
    assert.equal(surfboardMinPriceError(0), SURFBOARD_MIN_PRICE_MESSAGE)
    assert.equal(surfboardMinPriceError(Number.NaN), SURFBOARD_MIN_PRICE_MESSAGE)
    assert.equal(surfboardMinPriceError(50), null)
    assert.equal(surfboardMinPriceError(850), null)
  })
})

describe("surfboardPriceDropFloorError", () => {
  it("keeps the automatic drop from landing under $50", () => {
    assert.match(surfboardPriceDropFloorError(40, 200) ?? "", /at least \$50/)
    assert.equal(surfboardPriceDropFloorError(50, 200), null)
    assert.match(surfboardPriceDropFloorError(200, 200) ?? "", /less than your current list price/)
  })
})

describe("liveSurfboardPriceWriteError", () => {
  it("allows unfinished drafts and blocks live surfboard prices under $50", () => {
    assert.equal(
      liveSurfboardPriceWriteError({
        section: "surfboards",
        status: "draft",
        price: 20,
      }),
      null,
    )
    assert.equal(
      liveSurfboardPriceWriteError({
        section: "surfboards",
        status: "active",
        price: 49,
      }),
      SURFBOARD_MIN_PRICE_MESSAGE,
    )
    assert.equal(
      liveSurfboardPriceWriteError({
        section: "fins",
        status: "active",
        price: 12,
      }),
      null,
    )
  })
})

describe("surfboardOfferAmountError", () => {
  it("blocks surfboard offers under $50", () => {
    assert.equal(surfboardOfferAmountError(35, "surfboards"), SURFBOARD_OFFER_MIN_MESSAGE)
    assert.equal(surfboardOfferAmountError(50, "surfboards"), null)
    assert.equal(surfboardOfferAmountError(10, "fins"), null)
  })
})
