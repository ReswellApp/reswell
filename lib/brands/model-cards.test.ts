import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { BrandModelRow } from "@/lib/db/brand-models"
import type { BrandModelMarketplaceCover } from "@/lib/db/brand-listings"
import { toBrandPageModelCards } from "./model-cards.ts"

function model(name: string, id: string): BrandModelRow {
  return {
    id,
    brand_id: "album",
    name,
    description: `${name} description`,
    image_url: "https://cisurfboards.com/scraped.jpg",
    product_category_slug: "surfboards",
    board_category_slug: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  }
}

describe("toBrandPageModelCards", () => {
  it("omits used-board SKUs from the brand page models grid", () => {
    const cards = toBrandPageModelCards([
      model("Insanity", "1"),
      model("Insanity (Used)", "2"),
      model("Lightbender", "3"),
      model("Lightbender (Used)", "4"),
      model("Ledge Twinzer (Used)", "5"),
    ])
    assert.deepEqual(
      cards.map((card) => card.name),
      ["Insanity", "Lightbender"],
    )
  })

  it("never surfaces scraped catalog image_url; only marketplace covers", () => {
    const covers = new Map<string, BrandModelMarketplaceCover>([
      ["1", { imageUrl: "/media/listings/abc/thumb.jpg", activeCount: 2, soldCount: 5 }],
      ["3", { imageUrl: null, activeCount: 0, soldCount: 0 }],
    ])
    const cards = toBrandPageModelCards(
      [model("Insanity", "1"), model("Lightbender", "3")],
      covers,
    )
    assert.equal(cards[0]?.name, "Insanity")
    assert.equal(cards[0]?.listing_image_url, "/media/listings/abc/thumb.jpg")
    assert.equal(cards[0]?.active_listing_count, 2)
    assert.equal(cards[0]?.sold_listing_count, 5)
    assert.equal(cards[1]?.listing_image_url, null)
    assert.equal(cards[1]?.sold_listing_count, 0)
    assert.ok(cards.every((card) => !("image_url" in card)))
    assert.ok(cards.every((card) => !("description" in card)))
  })

  it("sorts models by marketplace activity before name", () => {
    const covers = new Map<string, BrandModelMarketplaceCover>([
      ["quiet", { imageUrl: null, activeCount: 0, soldCount: 1 }],
      ["hot", { imageUrl: null, activeCount: 3, soldCount: 10 }],
      ["mid", { imageUrl: null, activeCount: 1, soldCount: 1 }],
    ])
    const cards = toBrandPageModelCards(
      [model("Quiet", "quiet"), model("Alpha Hot", "hot"), model("Mid", "mid")],
      covers,
    )
    assert.deepEqual(
      cards.map((card) => card.name),
      ["Alpha Hot", "Mid", "Quiet"],
    )
  })
})
