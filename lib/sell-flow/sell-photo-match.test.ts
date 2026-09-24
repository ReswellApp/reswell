import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  coerceSellPhotoObservation,
  fillEmptyBoardDimensions,
  missingSellPhotoMatchShots,
  parseSellPhotoObservationJson,
  rankSellPhotoCatalogRows,
  selectVisualCatalogHits,
  sellPhotoCatalogQueries,
  sellPhotoEmbeddingOnlyObservation,
  sellPhotoEmbeddingQueryText,
  sellPhotoMatchDimensionFields,
  sellPhotoMatchLookupQuery,
  sellPhotoMatchSearchCategories,
  sniffSellPhotoMatchMime,
} from "./sell-photo-match.ts"
import type { SellCatalogSearchResultRow } from "../types/sell-catalog-search.ts"

describe("coerceSellPhotoObservation", () => {
  it("normalizes empty strings and a singular category", () => {
    const observation = coerceSellPhotoObservation({
      category: "surfboard",
      brandText: " Channel Islands ",
      modelText: "",
      visibleText: ["CI", "surfboard", "Twin Pin"],
      lengthText: "null",
      widthText: "",
      thicknessText: "unknown",
      confidence: "HIGH",
      summary: "Deck logo reads Channel Islands.",
    })
    assert.ok(observation)
    assert.equal(observation.category, "surfboards")
    assert.equal(observation.brandText, "Channel Islands")
    assert.equal(observation.modelText, null)
    assert.deepEqual(observation.visibleText, ["CI", "Twin Pin"])
    assert.equal(observation.lengthText, null)
    assert.equal(observation.widthText, null)
    assert.equal(observation.thicknessText, null)
    assert.equal(observation.confidence, "high")
  })

  it("rejects a non-object", () => {
    assert.equal(coerceSellPhotoObservation(null), null)
    assert.equal(coerceSellPhotoObservation("board"), null)
  })
})

describe("sellPhotoMatchLookupQuery", () => {
  it("prefers brand and model over other visible text", () => {
    const observation = coerceSellPhotoObservation({
      category: "fins",
      brandText: "FCS",
      modelText: "Performer",
      visibleText: ["M", "carbon"],
      lengthText: null,
      confidence: "high",
      summary: "FCS Performer fin.",
    })
    assert.ok(observation)
    assert.equal(sellPhotoMatchLookupQuery(observation), "FCS Performer")
    assert.deepEqual(sellPhotoMatchSearchCategories(), ["surfboards"])
  })

  it("falls back to readable text when brand and model are missing", () => {
    const observation = coerceSellPhotoObservation({
      category: "unknown",
      brandText: "unknown",
      modelText: null,
      visibleText: ["Lost", "RNF"],
      lengthText: "6'0",
      confidence: "low",
      summary: "Logo is partial.",
    })
    assert.ok(observation)
    assert.equal(sellPhotoMatchLookupQuery(observation), "Lost RNF")
    assert.deepEqual(sellPhotoMatchSearchCategories(), ["surfboards"])
  })

  it("returns null when nothing readable remains", () => {
    const observation = coerceSellPhotoObservation({
      category: "surfboards",
      brandText: null,
      modelText: null,
      visibleText: ["surfboard"],
      lengthText: null,
      confidence: "low",
      summary: "Plain white board, no logo.",
    })
    assert.ok(observation)
    assert.equal(sellPhotoMatchLookupQuery(observation), null)
  })
})

describe("sellPhotoMatchDimensionFields", () => {
  it("keeps length, width, and thickness the sell form can parse", () => {
    const observation = coerceSellPhotoObservation({
      category: "surfboards",
      brandText: "Channel Islands",
      modelText: "Twin Pin",
      visibleText: [],
      lengthText: "6'2\"",
      widthText: "19 1/4\"",
      thicknessText: "2 1/2",
      confidence: "high",
      summary: "Label is readable.",
    })
    assert.ok(observation)
    assert.deepEqual(sellPhotoMatchDimensionFields(observation), {
      boardLength: "6'2",
      boardWidthInches: "19 1/4",
      boardThicknessInches: "2 1/2",
    })
  })

  it("drops measurements the form would reject", () => {
    const observation = coerceSellPhotoObservation({
      category: "surfboards",
      brandText: null,
      modelText: null,
      visibleText: [],
      lengthText: "long",
      widthText: "wide",
      thicknessText: null,
      confidence: "low",
      summary: "Label is blurry.",
    })
    assert.ok(observation)
    assert.equal(sellPhotoMatchDimensionFields(observation), null)
  })

  it("fills only empty sell-form dimension fields", () => {
    const next = fillEmptyBoardDimensions(
      { boardLength: "5'10", boardWidthInches: "", boardThicknessInches: "2.5", extra: 1 },
      { boardLength: "6'2", boardWidthInches: "19", boardThicknessInches: "3" },
    )
    assert.equal(next.boardLength, "5'10")
    assert.equal(next.boardWidthInches, "19")
    assert.equal(next.boardThicknessInches, "2.5")
    assert.equal(next.extra, 1)
  })
})

describe("missingSellPhotoMatchShots", () => {
  it("lists the shots that were not uploaded", () => {
    assert.deepEqual(missingSellPhotoMatchShots(["top"]), ["bottom", "dimensions"])
    assert.deepEqual(missingSellPhotoMatchShots(["top", "bottom", "dimensions"]), [])
  })
})

describe("sell photo catalog match", () => {
  it("normalizes logo initials before the catalog query", () => {
    const observation = coerceSellPhotoObservation({
      category: "surfboards",
      brandText: "CI",
      modelText: "Twin Pin",
      visibleText: ["CI"],
      lengthText: "",
      widthText: "",
      thicknessText: "",
      confidence: "high",
      summary: "Deck logo is CI.",
    })
    assert.ok(observation)
    assert.equal(observation.brandText, "Channel Islands")
    assert.equal(sellPhotoMatchLookupQuery(observation), "Channel Islands Twin Pin")
    assert.deepEqual(sellPhotoCatalogQueries(observation), [
      "Channel Islands Twin Pin",
      "Twin Pin",
      "Channel Islands",
    ])
  })

  it("parses a fenced JSON observation", () => {
    const raw = parseSellPhotoObservationJson(
      '```json\n{"brandText":"Lost","modelText":"RNF","category":"surfboards"}\n```',
    )
    assert.deepEqual(raw, { brandText: "Lost", modelText: "RNF", category: "surfboards" })
  })

  it("keeps the model that matches brand and model and drops other boards", () => {
    const observation = coerceSellPhotoObservation({
      category: "surfboards",
      brandText: "Mayhem",
      modelText: "RNF",
      visibleText: [],
      lengthText: "5'11",
      widthText: null,
      thicknessText: null,
      confidence: "high",
      summary: "Mayhem RNF.",
    })
    assert.ok(observation)
    assert.equal(observation.brandText, "Lost")

    const twinPin: SellCatalogSearchResultRow = {
      kind: "model",
      id: "twin",
      name: "Twin Pin",
      brandId: "ci",
      brandName: "Channel Islands",
      brandSlug: "channel-islands",
      brandLogoUrl: null,
      imageUrl: null,
      description: null,
      category: "surfboards",
    }
    const rnf: SellCatalogSearchResultRow = {
      kind: "model",
      id: "rnf",
      name: "RNF 96",
      brandId: "lost",
      brandName: "Lost Surfboards",
      brandSlug: "lost",
      brandLogoUrl: null,
      imageUrl: null,
      description: null,
      category: "surfboards",
    }
    const brand: SellCatalogSearchResultRow = {
      kind: "brand",
      id: "lost",
      name: "Lost Surfboards",
      slug: "lost",
      logoUrl: null,
      shortDescription: null,
      category: "surfboards",
    }
    const ranked = rankSellPhotoCatalogRows(observation, [
      { row: twinPin, esScore: 80 },
      { row: brand, esScore: 90 },
      { row: rnf, esScore: 20 },
    ])
    assert.equal(ranked.matchTier, "exact")
    assert.deepEqual(
      ranked.rows.map((row) => row.id),
      ["rnf"],
    )
  })

  it("treats a one-character model misspelling as the same board", () => {
    const observation = coerceSellPhotoObservation({
      category: "surfboards",
      brandText: "Channel Islands",
      modelText: "Twn Pin",
      visibleText: [],
      lengthText: null,
      widthText: null,
      thicknessText: null,
      confidence: "medium",
      summary: "Logo reads CI, model is slightly blurry.",
    })
    assert.ok(observation)
    const twinPin: SellCatalogSearchResultRow = {
      kind: "model",
      id: "twin",
      name: "Twin Pin",
      brandId: "ci",
      brandName: "Channel Islands",
      brandSlug: "channel-islands",
      brandLogoUrl: null,
      imageUrl: null,
      description: null,
      category: "surfboards",
    }
    const ranked = rankSellPhotoCatalogRows(observation, [{ row: twinPin, esScore: 10 }])
    assert.equal(ranked.matchTier, "exact")
    assert.equal(ranked.rows[0]?.id, "twin")
  })
})

describe("selectVisualCatalogHits", () => {
  const twinPin: SellCatalogSearchResultRow = {
    kind: "model",
    id: "twin",
    name: "Twin Pin",
    brandId: "ci",
    brandName: "Channel Islands",
    brandSlug: "channel-islands",
    brandLogoUrl: null,
    imageUrl: null,
    description: null,
    category: "surfboards",
  }
  const rnf: SellCatalogSearchResultRow = {
    kind: "model",
    id: "rnf",
    name: "RNF 96",
    brandId: "lost",
    brandName: "Lost Surfboards",
    brandSlug: "lost",
    brandLogoUrl: null,
    imageUrl: null,
    description: null,
    category: "surfboards",
  }

  it("drops other brands when the logo was read", () => {
    const observation = coerceSellPhotoObservation({
      category: "surfboards",
      brandText: "Lost",
      modelText: "",
      visibleText: [],
      lengthText: null,
      widthText: null,
      thicknessText: null,
      confidence: "medium",
      summary: "Lost logo, model not readable.",
    })
    assert.ok(observation)
    const chosen = selectVisualCatalogHits(observation, [
      { row: twinPin, cosine: 0.96 },
      { row: rnf, cosine: 0.7 },
    ])
    assert.deepEqual(
      chosen.map((hit) => hit.row.id),
      ["rnf"],
    )
  })

  it("returns nothing when photo neighbors are tied", () => {
    const observation = sellPhotoEmbeddingOnlyObservation()
    const chosen = selectVisualCatalogHits(observation, [
      { row: twinPin, cosine: 0.9 },
      { row: rnf, cosine: 0.89 },
    ])
    assert.deepEqual(chosen, [])
  })

  it("keeps one board when the photo is clearly closer", () => {
    const observation = sellPhotoEmbeddingOnlyObservation()
    const chosen = selectVisualCatalogHits(observation, [
      { row: rnf, cosine: 0.91 },
      { row: twinPin, cosine: 0.8 },
    ])
    assert.deepEqual(
      chosen.map((hit) => hit.row.id),
      ["rnf"],
    )
  })
})

describe("sellPhotoEmbeddingQueryText", () => {
  it("uses the brand and model and skips a generic board word", () => {
    const observation = coerceSellPhotoObservation({
      category: "surfboards",
      brandText: "Channel Islands",
      modelText: "Twin Pin",
      visibleText: ["surfboard"],
      lengthText: null,
      widthText: null,
      thicknessText: null,
      confidence: "high",
      summary: "CI Twin Pin.",
    })
    assert.ok(observation)
    assert.equal(sellPhotoEmbeddingQueryText(observation), "Channel Islands Twin Pin")
  })
})

describe("sniffSellPhotoMatchMime", () => {
  it("recognizes jpeg, png, and webp headers", () => {
    assert.equal(sniffSellPhotoMatchMime(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg")
    assert.equal(
      sniffSellPhotoMatchMime(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
      "image/png",
    )
    const webp = new Uint8Array(12)
    webp.set([0x52, 0x49, 0x46, 0x46], 0)
    webp.set([0x57, 0x45, 0x42, 0x50], 8)
    assert.equal(sniffSellPhotoMatchMime(webp), "image/webp")
  })

  it("rejects other files", () => {
    assert.equal(sniffSellPhotoMatchMime(Uint8Array.from([0x00, 0x01, 0x02])), null)
  })
})
