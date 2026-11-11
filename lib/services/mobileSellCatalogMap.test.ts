import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { MOBILE_SELL_CATALOG_CATEGORIES } from "@reswell/api-contract"
import {
  boardTypeFromCatalogSlug,
  mapMobileSellBrandModels,
  mapMobileSellBrandSuggest,
  mapMobileSellCatalog,
  mobileCategoryForBrand,
} from "@/lib/services/mobileSellCatalogMap"
import { SELL_CATALOG_SEARCH_CATEGORIES, type SellCatalogSearchResult } from "@/lib/types/sell-catalog-search"

describe("mobile sell catalog map", () => {
  it("stays on the same categories as the website sell search", () => {
    assert.deepEqual([...MOBILE_SELL_CATALOG_CATEGORIES], [...SELL_CATALOG_SEARCH_CATEGORIES])
  })

  it("normalizes board-style aliases", () => {
    assert.equal(boardTypeFromCatalogSlug("gun"), "step-up-gun")
    assert.equal(boardTypeFromCatalogSlug("funboard"), "hybrid")
    assert.equal(boardTypeFromCatalogSlug("fish"), "fish")
    assert.equal(boardTypeFromCatalogSlug("not-a-shape"), null)
  })

  it("maps a model hit into brand, model, category, and board style", () => {
    const result: SellCatalogSearchResult = {
      results: [
        {
          kind: "model",
          id: "model-1",
          name: "Ghost",
          brandId: "brand-1",
          brandName: "Album",
          brandSlug: "album",
          brandLogoUrl: null,
          imageUrl: "https://cdn.example/ghost.jpg",
          description: null,
          category: "surfboards",
          boardCategorySlug: "groveler",
        },
      ],
      similarResults: [],
      meta: { backend: "supabase", matchTier: "exact" },
    }

    const mapped = mapMobileSellCatalog(result)
    assert.equal(mapped.results.length, 1)
    assert.deepEqual(mapped.results[0], {
      kind: "model",
      id: "model-1",
      brand_id: "brand-1",
      brand_name: "Album",
      model_name: "Ghost",
      category: "surfboards",
      category_label: "Surfboards",
      board_type: "groveler",
      image_url: "https://cdn.example/ghost.jpg",
      title: "Album Ghost",
    })
  })

  it("uses similar matches only when nothing exact hit", () => {
    const result: SellCatalogSearchResult = {
      results: [],
      similarResults: [
        {
          kind: "brand",
          id: "brand-1",
          name: "FCS",
          slug: "fcs",
          logoUrl: null,
          shortDescription: null,
          category: "fins",
        },
      ],
      meta: { backend: "supabase", matchTier: "similar" },
    }

    const mapped = mapMobileSellCatalog(result)
    assert.equal(mapped.results[0]?.kind, "brand")
    assert.equal(mapped.results[0]?.category_label, "Fins")
    assert.equal(mapped.results[0]?.model_name, null)
  })

  it("maps directory brand suggest rows as brands only", () => {
    const mapped = mapMobileSellBrandSuggest(
      [
        {
          id: "brand-1",
          name: "Channel Islands",
          slug: "channel-islands",
          short_description: "Al Merrick",
          logo_url: "https://cdn.example/ci.png",
          location_label: "Carpinteria, CA",
          lead_shaper_name: "Al Merrick",
        },
      ],
      new Map([["brand-1", ["surfboards"]]]),
    )
    assert.equal(mapped.results.length, 1)
    assert.deepEqual(mapped.results[0], {
      kind: "brand",
      id: "brand-1",
      brand_id: "brand-1",
      brand_name: "Channel Islands",
      model_name: null,
      category: "surfboards",
      category_label: "Surfboards",
      board_type: null,
      image_url: "https://cdn.example/ci.png",
      title: "Channel Islands",
    })
  })

  it("defaults untagged directory brands to surfboards", () => {
    assert.equal(mobileCategoryForBrand([]), "surfboards")
    assert.equal(mobileCategoryForBrand(["boardbags", "fins"]), "fins")
  })

  it("maps brand-models drill-in rows the same way as search hits", () => {
    const mapped = mapMobileSellBrandModels([
      {
        kind: "model",
        id: "model-2",
        name: "Sweet Spot",
        brandId: "brand-2",
        brandName: "Pyzel",
        brandSlug: "pyzel",
        brandLogoUrl: null,
        imageUrl: null,
        description: null,
        category: "surfboards",
        boardCategorySlug: "shortboard",
      },
    ])
    assert.equal(mapped.results.length, 1)
    assert.equal(mapped.results[0]?.kind, "model")
    assert.equal(mapped.results[0]?.brand_name, "Pyzel")
    assert.equal(mapped.results[0]?.model_name, "Sweet Spot")
    assert.equal(mapped.results[0]?.board_type, "shortboard")
  })

  it("drops non-model rows from brand-models drill-in", () => {
    const mapped = mapMobileSellBrandModels([
      {
        kind: "brand",
        id: "brand-2",
        name: "Pyzel",
        slug: "pyzel",
        logoUrl: null,
        shortDescription: null,
        category: "surfboards",
      },
    ])
    assert.equal(mapped.results.length, 0)
  })
})
