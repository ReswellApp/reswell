import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { BrandModelRow } from "@/lib/db/brand-models"
import { toBrandPageModelCards } from "./model-cards.ts"

function model(name: string, id: string): BrandModelRow {
  return {
    id,
    brand_id: "album",
    name,
    description: `${name} description`,
    image_url: null,
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
})
