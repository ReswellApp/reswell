import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DEFAULT_LISTING_HERO_ASPECT,
  LISTING_PDP_HERO_IMAGE_SIZES,
  listingHeroAspectCss,
  listingMobileHeroFrameVars,
} from "./listing-hero-frame.ts"

describe("listingHeroAspectCss", () => {
  it("emits a slash ratio so iOS WebKit accepts the custom property", () => {
    assert.equal(listingHeroAspectCss(DEFAULT_LISTING_HERO_ASPECT), "750 / 1000")
    assert.equal(listingHeroAspectCss(4 / 3), "1333 / 1000")
  })

  it("falls back to 3 / 4 for empty or invalid measurements", () => {
    assert.equal(listingHeroAspectCss(0), "3 / 4")
    assert.equal(listingHeroAspectCss(-1), "3 / 4")
    assert.equal(listingHeroAspectCss(Number.NaN), "3 / 4")
  })
})

describe("listingMobileHeroFrameVars", () => {
  it("sets --listing-hero-aspect for the mobile hero frame", () => {
    assert.deepEqual(listingMobileHeroFrameVars(2 / 3), {
      "--listing-hero-aspect": "667 / 1000",
    })
  })
})

describe("LISTING_PDP_HERO_IMAGE_SIZES", () => {
  it("uses vw so Chrome / Google on iOS still parse the descriptor", () => {
    assert.equal(LISTING_PDP_HERO_IMAGE_SIZES.includes("svw"), false)
    assert.equal(LISTING_PDP_HERO_IMAGE_SIZES.includes("100vw"), true)
  })
})
