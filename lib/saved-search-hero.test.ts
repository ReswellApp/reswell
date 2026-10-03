import assert from "node:assert/strict"
import { register } from "node:module"
import { before, describe, it } from "node:test"

register(
  "data:text/javascript," +
    encodeURIComponent(`
import { pathToFileURL } from "node:url"
import { join } from "node:path"
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const abs = join(${JSON.stringify("/workspace")}, specifier.slice(2))
    const file = abs.endsWith(".ts") ? abs : abs + ".ts"
    return { url: pathToFileURL(file).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
`),
)

let hero: typeof import("./saved-search-hero.ts")

before(async () => {
  hero = await import("./saved-search-hero.ts")
})

const FULL =
  "https://abc.supabase.co/storage/v1/object/public/listings/user/board-full.jpg"
const THUMB =
  "https://abc.supabase.co/storage/v1/object/public/listings/user/board-full-thumb.jpg"

describe("savedSearchHeroFromListing", () => {
  it("uses the full photo, price, and listing link of the newest match", () => {
    const listing = hero.savedSearchHeroFromListing({
      id: "6f1c0b2e-3a4d-4e5f-8a7b-9c0d1e2f3a4b",
      slug: "ci-happy-everyday",
      title: "Channel Islands Happy Everyday",
      price: 825,
      section: "surfboards",
      primary_image_url: FULL,
      primary_thumbnail_url: THUMB,
    })

    assert.ok(listing)
    assert.equal(listing.priceLabel, "$825.00")
    assert.equal(listing.price, 825)
    assert.equal(listing.href, "/l/ci-happy-everyday")
    assert.equal(listing.listingUrl, "https://www.reswell.app/l/ci-happy-everyday")
    assert.match(listing.imageSrc, /board-full\.jpg/)
    assert.doesNotMatch(listing.imageSrc, /thumb/)
    assert.match(listing.klaviyoPhotoUrl, /board-full\.jpg/)
    assert.doesNotMatch(listing.klaviyoPhotoUrl, /opengraph-image/)
    assert.doesNotMatch(listing.klaviyoPhotoUrl, /thumb/)
  })

  it("sends no photo url when the listing has no image", () => {
    const listing = hero.savedSearchHeroFromListing({
      id: "6f1c0b2e-3a4d-4e5f-8a7b-9c0d1e2f3a4b",
      slug: "plain-board",
      title: "Plain board",
      price: "400.5",
      primary_image_url: null,
      primary_thumbnail_url: null,
    })

    assert.ok(listing)
    assert.equal(listing.priceLabel, "$400.50")
    assert.equal(listing.imageSrc, "")
    assert.equal(listing.klaviyoPhotoUrl, "")
  })

  it("falls back to the thumbnail only when there is no full photo", () => {
    const listing = hero.savedSearchHeroFromListing({
      id: "6f1c0b2e-3a4d-4e5f-8a7b-9c0d1e2f3a4b",
      title: "Thumb only",
      price: 100,
      primary_image_url: "  ",
      primary_thumbnail_url: THUMB,
    })

    assert.ok(listing)
    assert.match(listing.klaviyoPhotoUrl, /thumb/)
    assert.equal(listing.imageSrc.includes("thumb") || listing.imageSrc.length > 0, true)
  })
})
