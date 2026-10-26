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

  it("ships the website shipping section for each category", () => {
    const taxonomy = getMobileSellTaxonomy()
    const bySlug = new Map(taxonomy.categories.map((category) => [category.slug, category.fulfillment]))

    for (const [slug, fulfillment] of bySlug.entries()) {
      assert.equal(fulfillment.shipping_default, true)
      assert.equal(fulfillment.local_pickup_default, false)
      assert.equal(
        fulfillment.local_pickup,
        slug === "surfboards",
        `${slug} local_pickup should only be true for surfboards`,
      )
      if (slug !== "surfboards") {
        assert.deepEqual(
          fulfillment.shipping_options.map((option) => option.id),
          ["reswell", "free", "flat"],
          `${slug} should expose Reswell, free, and flat shipping`,
        )
      }
    }

    const surfboards = bySlug.get("surfboards")
    assert.equal(surfboards?.title, "Shipping")
    assert.equal(surfboards?.dropoff, true)
    assert.equal(surfboards?.local_pickup, true)
    assert.equal(surfboards?.shipping_toggle, true)
    assert.equal(surfboards?.delivery_title, "Delivery options")
    assert.equal(surfboards?.shipping_badge, "Items sell faster")
    assert.equal(surfboards?.cost_title, "Shipping cost in the Continental U.S.")
    assert.deepEqual(
      surfboards?.shipping_options.map((option) => option.id),
      ["reswell", "free", "flat"],
    )
    assert.equal(surfboards?.shipping_options[0]?.badge, "Recommended")

    const fins = bySlug.get("fins")
    assert.equal(fins?.title, "Shipping")
    assert.equal(fins?.local_pickup, false)
    assert.equal(fins?.shipping_options.length, 3)

    const wetsuits = bySlug.get("wetsuits")
    assert.equal(wetsuits?.local_pickup, false)

    const apparel = bySlug.get("apparel")
    assert.equal(apparel?.title, "Shipping")
    assert.equal(apparel?.shipping_toggle, false)

    const leash = bySlug.get("leashes")
    assert.equal(leash?.shipping_toggle, false)
    assert.equal(leash?.shipping_options[0]?.id, "reswell")

    const magazines = bySlug.get("magazines")
    assert.equal(magazines?.title, "Shipping")
    assert.equal(magazines?.local_pickup, false)
    assert.equal(magazines?.package_dimensions, true)

    assert.equal(taxonomy.categories.find((category) => category.slug === "surfboards")?.board_specs, true)
    for (const category of taxonomy.categories) {
      if (category.slug === "surfboards") continue
      assert.equal(category.board_specs, false)
    }
  })
})
