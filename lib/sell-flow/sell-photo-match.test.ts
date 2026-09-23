import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  coerceSellPhotoObservation,
  fillEmptyBoardDimensions,
  missingSellPhotoMatchShots,
  sellPhotoMatchDimensionFields,
  sellPhotoMatchLookupQuery,
  sellPhotoMatchSearchCategories,
  sniffSellPhotoMatchMime,
} from "./sell-photo-match.ts"

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
