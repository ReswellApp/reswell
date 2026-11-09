import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildIndexedMemoryPromptSections,
  formatDimensionPhotoMemoryCaption,
  inferDimensionPhotoFailureMode,
  inferDimensionPhotoStampStyle,
  lengthBandFromText,
  pickDiverseMemoryRows,
  rankMemoryRowsForQueries,
  type DimensionPhotoMemoryCatalogRow,
} from "./surfboardDimensionPhotoMemoryCatalog.ts"

function row(
  partial: Partial<DimensionPhotoMemoryCatalogRow> & Pick<DimensionPhotoMemoryCatalogRow, "id" | "kind">,
): DimensionPhotoMemoryCatalogRow {
  return {
    failureMode: null,
    stampStyle: null,
    lengthBand: "6",
    imageUrl: "https://example.com/a.jpg",
    phash: null,
    caption: `${partial.kind} ${partial.id}`,
    predictedLength: null,
    predictedWidth: null,
    predictedThickness: null,
    predictedVolume: null,
    actualLength: null,
    actualWidth: null,
    actualThickness: null,
    actualVolume: null,
    ratingNote: null,
    updatedAt: "2026-11-09T00:00:00.000Z",
    ...partial,
  }
}

describe("dimension photo memory catalog", () => {
  it("infers failure modes and stamp styles from admin/vision text", () => {
    assert.equal(
      inferDimensionPhotoFailureMode({ summary: "lifestyle beauty shot of the deck" }),
      "beauty",
    )
    assert.equal(
      inferDimensionPhotoFailureMode({ summary: "logo only, no numbers" }),
      "logo",
    )
    assert.equal(
      inferDimensionPhotoFailureMode({
        dimsRating: "close",
        note: "width fraction should be 19 1/4",
      }),
      "fraction",
    )
    assert.equal(inferDimensionPhotoStampStyle("handwriting on the stringer"), "stringer")
    assert.equal(lengthBandFromText("6'2"), "6")
  })

  it("puts ground-truth actual dims in Close/Bad captions", () => {
    const caption = formatDimensionPhotoMemoryCaption({
      kind: "dims_close",
      predictedLength: "6'2",
      predictedWidth: "19",
      predictedThickness: "2 1/2",
      actualLength: "6'2",
      actualWidth: "19 1/4",
      actualThickness: "2 1/2",
    })
    assert.match(caption, /DIMS CLOSE/)
    assert.match(caption, /actual 6'2 × 19 1\/4 × 2 1\/2/)
  })

  it("ranks hashed neighbors ahead of unhashed recency", () => {
    const query = ["aaaaaaaaaaaaaaaa"]
    const ranked = rankMemoryRowsForQueries(
      [
        row({ id: "old", kind: "photo_bad", phash: null, updatedAt: "2026-11-09T12:00:00.000Z" }),
        row({
          id: "near",
          kind: "photo_bad",
          phash: "aaaaaaaaaaaaaaab",
          updatedAt: "2026-11-01T00:00:00.000Z",
        }),
      ],
      query,
    )
    assert.equal(ranked[0]?.id, "near")
    assert.ok((ranked[0]?.retrievalScore ?? 99) < (ranked[1]?.retrievalScore ?? 0))
  })

  it("diversifies few-shot slots across failure modes", () => {
    const ranked = [
      { id: "b1", retrievalScore: 1, failureMode: "beauty" },
      { id: "b2", retrievalScore: 2, failureMode: "beauty" },
      { id: "b3", retrievalScore: 3, failureMode: "beauty" },
      { id: "o1", retrievalScore: 4, failureMode: "outline" },
      { id: "l1", retrievalScore: 5, failureMode: "logo" },
    ]
    const picked = pickDiverseMemoryRows(ranked, 3, (r) => r.failureMode)
    assert.deepEqual(
      picked.map((r) => r.id),
      ["b1", "o1", "l1"],
    )
  })

  it("builds labeled Good/Bad/Close sections for the prompt", () => {
    const sections = buildIndexedMemoryPromptSections([
      row({
        id: "g",
        kind: "photo_good",
        caption: "GOOD stamp example: stringer",
      }),
      row({
        id: "c",
        kind: "dims_close",
        caption: "DIMS CLOSE · actual 6'0 × 19 × 2 1/2",
        actualLength: "6'0",
        actualWidth: "19",
        actualThickness: "2 1/2",
      }),
    ])
    const text = sections.join("\n")
    assert.match(text, /Indexed admin memory/)
    assert.match(text, /GOOD photo picks/)
    assert.match(text, /Ground-truth corrections/)
  })
})
