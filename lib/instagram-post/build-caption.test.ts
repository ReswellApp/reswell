import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  INSTAGRAM_CAPTION_MAX,
  buildInstagramPostCaption,
  formatInstagramPrice,
  orderedListingFullImageUrls,
  stripHtmlToPlainText,
} from "./build-caption.ts"

describe("stripHtmlToPlainText", () => {
  it("turns breaks and tags into readable text", () => {
    assert.equal(
      stripHtmlToPlainText("<p>Glassed last year.</p><br>No dings."),
      "Glassed last year.\n\nNo dings.",
    )
  })
})

describe("formatInstagramPrice", () => {
  it("drops cents on whole dollars", () => {
    assert.equal(formatInstagramPrice(850), "$850")
    assert.equal(formatInstagramPrice(850.5), "$850.50")
  })
})

describe("orderedListingFullImageUrls", () => {
  it("puts the primary photo first and skips blanks", () => {
    assert.deepEqual(
      orderedListingFullImageUrls([
        { url: "https://cdn.example/b.jpg", sort_order: 2, is_primary: false },
        { url: "  ", sort_order: 0, is_primary: false },
        { url: "https://cdn.example/a.jpg", sort_order: 1, is_primary: true },
        { url: "https://cdn.example/a.jpg", sort_order: 3, is_primary: false },
      ]),
      ["https://cdn.example/a.jpg", "https://cdn.example/b.jpg"],
    )
  })
})

describe("buildInstagramPostCaption", () => {
  it("includes title, price, specs, description, and the shop link", () => {
    const caption = buildInstagramPostCaption({
      title: "lost puddle jumper 5'8",
      description: "One owner. Ridden in clean San Clemente waves.",
      price: 850,
      section: "surfboards",
      board_type: "fish",
      brand: "Lost",
      model: "Puddle Jumper",
      condition: "excellent",
      dimensions: "(5'8 20 1/2 2 1/2 32.5L)",
      construction: "pu_poly",
      fin_system: "fcs_ii",
      fins_setup: "thruster",
      fins_included: true,
      listingUrl: "https://www.reswell.app/l/lost-puddle-jumper",
      shopName: "Hayden Garfield Shop",
    })

    assert.match(caption, /Lost Puddle Jumper 5'8/)
    assert.match(caption, /\$850/)
    assert.match(caption, /Brand: Lost/)
    assert.match(caption, /Model: Puddle Jumper/)
    assert.match(caption, /Type: Fish/)
    assert.match(caption, /Condition:/)
    assert.match(caption, /Dimensions: 5'8″ × 20 1\/2″ × 2 1\/2″ · 32\.5 L/)
    assert.match(caption, /One owner\. Ridden in clean San Clemente waves\./)
    assert.match(caption, /Shop this listing: https:\/\/www\.reswell\.app\/l\/lost-puddle-jumper/)
    assert.match(caption, /Hayden Garfield Shop/)
  })

  it("formats stored dimension JSON the same way listing pages do", () => {
    const caption = buildInstagramPostCaption({
      title: "Channel Islands Twin Pin",
      price: 850,
      section: "surfboards",
      dimensions: '{"V":"2","L":"6\'0","W":"20 1/2","T":"2 5/8"}',
      construction: "pu_poly",
      listingUrl: "https://www.reswell.app/l/ci-twin-pin",
    })

    assert.match(caption, /Dimensions: 6'0″ × 20 1\/2″ × 2 5\/8″/)
    assert.doesNotMatch(caption, /\{"V":/)
  })

  it("stays within Instagram's caption limit when the description is huge", () => {
    const caption = buildInstagramPostCaption({
      title: "Board",
      description: "Ding-free. ".repeat(400),
      price: 100,
      listingUrl: "https://www.reswell.app/l/board",
    })
    assert.ok(caption.length <= INSTAGRAM_CAPTION_MAX)
    assert.match(caption, /Shop this listing: https:\/\/www\.reswell\.app\/l\/board/)
  })
})
