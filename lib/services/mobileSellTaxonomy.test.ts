import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { MOBILE_LISTING_CATEGORIES } from "@reswell/api-contract"
import { BOARD_STYLE_OPTIONS } from "@/lib/boards-browse-facets"
import { getMobileSellTaxonomy } from "@/lib/services/mobileSellTaxonomy"

describe("mobile sell taxonomy", () => {
  it("lists marketplace categories in browse order", () => {
    const taxonomy = getMobileSellTaxonomy()
    assert.deepEqual(
      taxonomy.categories.map((category) => category.slug),
      [...MOBILE_LISTING_CATEGORIES],
    )
    assert.equal(taxonomy.categories.find((category) => category.slug === "surfboards")?.label, "Surfboards")
    assert.equal(taxonomy.categories.find((category) => category.slug === "fins")?.label, "Fins")
    assert.equal(taxonomy.categories.find((category) => category.slug === "apparel")?.label, "Apparel")
  })

  it("uses the surfboard style filters as the only subcategory", () => {
    const taxonomy = getMobileSellTaxonomy()
    const surfboards = taxonomy.categories.find((category) => category.slug === "surfboards")
    assert.equal(surfboards?.subcategory_label, "Board style")
    assert.deepEqual(
      surfboards?.subcategories.map((option) => option.slug),
      BOARD_STYLE_OPTIONS.map((option) => option.value),
    )
    assert.deepEqual(surfboards?.subcategories.slice(0, 3).map((option) => option.label), [
      "Shortboard",
      "Groveler",
      "Fish",
    ])

    for (const category of taxonomy.categories) {
      if (category.slug === "surfboards") continue
      assert.equal(category.subcategory_label, null)
      assert.deepEqual(category.subcategories, [])
    }
  })
})
