import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { lowestListingPrice, modelPageHeroOffer, modelUsedRangeLabel } from "./model-page-hero.ts"

describe("modelUsedRangeLabel", () => {
  it("hides the gathering placeholder", () => {
    assert.equal(modelUsedRangeLabel(null, null), null)
    assert.equal(modelUsedRangeLabel(325, 475), "$325 – $475")
  })
})

describe("lowestListingPrice", () => {
  it("ignores empty and non-finite prices", () => {
    assert.equal(lowestListingPrice([Number.NaN, 0, 550, 450]), 450)
    assert.equal(lowestListingPrice([]), null)
  })
})

describe("modelPageHeroOffer", () => {
  it("leads with the one board you can buy", () => {
    assert.deepEqual(
      modelPageHeroOffer({
        listingCount: 1,
        lowestPriceUsd: 450,
        lengthLabel: "5'9\"",
        conditionLabel: "Very Good",
        usedRange: "$325 – $475",
      }),
      {
        kind: "listing",
        supporting: "5'9\" · Very Good",
      },
    )
  })

  it("leads with the lowest ask when several boards are listed", () => {
    assert.deepEqual(
      modelPageHeroOffer({
        listingCount: 3,
        lowestPriceUsd: 400,
        lengthLabel: null,
        conditionLabel: null,
        usedRange: "$325 – $475",
      }),
      {
        kind: "from",
        headline: "From $400",
        supporting: "3 for sale · similar boards sell for $325 – $475",
      },
    )
  })

  it("leads with the used range when nothing is listed", () => {
    assert.deepEqual(
      modelPageHeroOffer({
        listingCount: 0,
        lowestPriceUsd: null,
        lengthLabel: null,
        conditionLabel: null,
        usedRange: "$325 – $475",
      }),
      {
        kind: "range",
        headline: "$325 – $475",
        supporting: "None for sale · estimated used value",
      },
    )
  })

  it("stays quiet when there is no price yet", () => {
    assert.deepEqual(
      modelPageHeroOffer({
        listingCount: 0,
        lowestPriceUsd: null,
        lengthLabel: null,
        conditionLabel: null,
        usedRange: null,
      }),
      { kind: "unavailable", supporting: "None listed right now" },
    )
  })
})
