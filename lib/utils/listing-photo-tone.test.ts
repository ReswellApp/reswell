import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isValidListingMediaObjectPath } from "@/lib/listing-media-proxy-path-validation"
import {
  LISTING_PHOTO_TONE_IDENTITY,
  applyListingPhotoToneToPixels,
  clampListingPhotoTone,
  isListingPhotoToneIdentity,
  listingPhotoToneFromStops,
  listingPhotoToneObjectsToRemove,
  listingPhotoToneRecipeFromRow,
  listingPhotoToneRgb,
  listingPhotoToneStoragePaths,
  listingPhotoTonesEqual,
  parseListingPhotoToneActiveRecipes,
  planListingPhotoToneSave,
  resolveListingPhotoToneEdit,
  type ListingPhotoToneRecipe,
} from "./listing-photo-tone.ts"

const ORIGINAL = "https://app.reswell.app/storage/v1/object/public/listings/user/1-full.webp"
const ORIGINAL_THUMB = ORIGINAL.replace("-full.", "-thumb.")
const BAKED = "https://app.reswell.app/storage/v1/object/public/listings/user/2-full.webp"
const BAKED_THUMB = BAKED.replace("-full.", "-thumb.")
const REPLACED = "https://app.reswell.app/storage/v1/object/public/listings/user/3-full.webp"
const REPLACED_THUMB = REPLACED.replace("-full.", "-thumb.")

function recipe(overrides: Partial<ListingPhotoToneRecipe> = {}): ListingPhotoToneRecipe {
  return {
    sourceUrl: ORIGINAL,
    sourceThumbnailUrl: ORIGINAL_THUMB,
    renditionUrl: BAKED,
    renditionThumbnailUrl: BAKED_THUMB,
    tone: { brightness: 20, highlights: 0, shadows: 10, contrast: 0 },
    ...overrides,
  }
}

describe("listingPhotoToneFromStops", () => {
  it("treats a missing recipe as no adjustment", () => {
    assert.deepEqual(listingPhotoToneFromStops(null), LISTING_PHOTO_TONE_IDENTITY)
    assert.deepEqual(listingPhotoToneFromStops({}), LISTING_PHOTO_TONE_IDENTITY)
    assert.equal(isListingPhotoToneIdentity(null), true)
  })

  it("reads PostgREST numeric strings and clamps", () => {
    assert.deepEqual(
      listingPhotoToneFromStops({
        brightness: "12",
        highlights: "-40",
        shadows: 200,
        contrast: "-3.2",
      }),
      { brightness: 12, highlights: -40, shadows: 100, contrast: -3 },
    )
  })
})

describe("resolveListingPhotoToneEdit", () => {
  it("bakes from the public photo when there is no recipe", () => {
    assert.deepEqual(
      resolveListingPhotoToneEdit({
        publicUrl: ORIGINAL,
        publicThumbnailUrl: ORIGINAL_THUMB,
        recipe: null,
      }),
      {
        sourceUrl: ORIGINAL,
        sourceThumbnailUrl: ORIGINAL_THUMB,
        tone: LISTING_PHOTO_TONE_IDENTITY,
        renditionIsCurrent: false,
        staleRenditionUrl: null,
        staleRenditionThumbnailUrl: null,
      },
    )
  })

  it("keeps the original when the listing still points at the rendition", () => {
    const edit = resolveListingPhotoToneEdit({
      publicUrl: ` ${BAKED} `,
      publicThumbnailUrl: BAKED_THUMB,
      recipe: recipe({ sourceUrl: ` ${ORIGINAL} ` }),
    })
    assert.equal(edit.renditionIsCurrent, true)
    assert.equal(edit.sourceUrl, ORIGINAL)
    assert.equal(edit.tone.brightness, 20)
    assert.equal(edit.staleRenditionUrl, null)
  })

  it("treats a replaced upload as a new original", () => {
    const edit = resolveListingPhotoToneEdit({
      publicUrl: REPLACED,
      publicThumbnailUrl: REPLACED_THUMB,
      recipe: recipe(),
    })
    assert.equal(edit.renditionIsCurrent, false)
    assert.equal(edit.sourceUrl, REPLACED)
    assert.deepEqual(edit.tone, LISTING_PHOTO_TONE_IDENTITY)
    assert.equal(edit.staleRenditionUrl, BAKED)
  })
})

describe("listingPhotoToneRgb", () => {
  it("leaves identity pixels unchanged", () => {
    assert.deepEqual(listingPhotoToneRgb(17, 80, 210, LISTING_PHOTO_TONE_IDENTITY), [17, 80, 210])
  })

  it("raises and lowers brightness", () => {
    const [brighter] = listingPhotoToneRgb(128, 128, 128, {
      ...LISTING_PHOTO_TONE_IDENTITY,
      brightness: 40,
    })
    const [darker] = listingPhotoToneRgb(128, 128, 128, {
      ...LISTING_PHOTO_TONE_IDENTITY,
      brightness: -40,
    })
    assert.ok(brighter > 128)
    assert.ok(darker < 128)
  })

  it("pushes contrast away from mid gray", () => {
    const [light] = listingPhotoToneRgb(200, 200, 200, {
      ...LISTING_PHOTO_TONE_IDENTITY,
      contrast: 80,
    })
    const [dark] = listingPhotoToneRgb(60, 60, 60, {
      ...LISTING_PHOTO_TONE_IDENTITY,
      contrast: 80,
    })
    assert.ok(light > 200)
    assert.ok(dark < 60)
  })

  it("lifts shadows without moving a near-white pixel as much", () => {
    const tone = { ...LISTING_PHOTO_TONE_IDENTITY, shadows: 50 }
    const [shadow] = listingPhotoToneRgb(30, 30, 30, tone)
    const [white] = listingPhotoToneRgb(245, 245, 245, tone)
    assert.ok(shadow - 30 > white - 245)
    assert.ok(shadow > 30)
  })

  it("pulls highlights without crushing a near-black pixel as much", () => {
    const tone = { ...LISTING_PHOTO_TONE_IDENTITY, highlights: -50 }
    const [highlight] = listingPhotoToneRgb(230, 230, 230, tone)
    const [black] = listingPhotoToneRgb(12, 12, 12, tone)
    assert.ok(230 - highlight > 12 - black)
    assert.ok(highlight < 230)
  })

  it("keeps a neutral pixel neutral", () => {
    const [r, g, b] = listingPhotoToneRgb(90, 90, 90, {
      brightness: 15,
      highlights: -20,
      shadows: 25,
      contrast: 10,
    })
    assert.equal(r, g)
    assert.equal(g, b)
  })
})

describe("applyListingPhotoToneToPixels", () => {
  it("skips alpha and leaves identity buffers untouched", () => {
    const pixels = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 128])
    const copy = new Uint8ClampedArray(pixels)
    applyListingPhotoToneToPixels(pixels, 4, LISTING_PHOTO_TONE_IDENTITY)
    assert.deepEqual(pixels, copy)
  })

  it("writes RGB and keeps alpha", () => {
    const pixels = new Uint8ClampedArray([128, 128, 128, 200])
    applyListingPhotoToneToPixels(pixels, 4, {
      ...LISTING_PHOTO_TONE_IDENTITY,
      brightness: 30,
    })
    assert.ok(pixels[0] > 128)
    assert.equal(pixels[3], 200)
  })
})

describe("listingPhotoToneObjectsToRemove", () => {
  it("keeps the original on the first bake", () => {
    assert.deepEqual(
      listingPhotoToneObjectsToRemove({
        previousFullUrl: ORIGINAL,
        previousThumbUrl: ORIGINAL_THUMB,
        sourceFullUrl: ORIGINAL,
      }),
      [],
    )
  })

  it("removes the previous baked full, thumb, card, and film", () => {
    assert.deepEqual(
      listingPhotoToneObjectsToRemove({
        previousFullUrl: BAKED,
        previousThumbUrl: BAKED_THUMB,
        sourceFullUrl: ORIGINAL,
      }),
      [
        BAKED,
        BAKED.replace("-full.", "-thumb."),
        BAKED.replace("-full.", "-card2."),
        BAKED.replace("-full.", "-film2."),
      ],
    )
  })

  it("keeps a seller replacement that shares no path with the old rendition", () => {
    const removed = listingPhotoToneObjectsToRemove({
      previousFullUrl: BAKED,
      previousThumbUrl: BAKED_THUMB,
      sourceFullUrl: ORIGINAL,
      keepUrls: [REPLACED, REPLACED_THUMB, ORIGINAL, ORIGINAL_THUMB],
    })
    assert.equal(removed.includes(REPLACED), false)
    assert.equal(removed.includes(ORIGINAL), false)
    assert.equal(removed.includes(BAKED), true)
  })
})

describe("planListingPhotoToneSave", () => {
  it("bakes the first copy from the upload and deletes nothing", () => {
    const plan = planListingPhotoToneSave({
      publicUrl: ORIGINAL,
      publicThumbnailUrl: ORIGINAL_THUMB,
      requested: { brightness: 15, highlights: 0, shadows: 0, contrast: 0 },
      recipe: null,
    })
    assert.equal(plan.action, "bake")
    if (plan.action !== "bake") return
    assert.equal(plan.sourceUrl, ORIGINAL)
    assert.deepEqual(plan.removeUrls, [])
  })

  it("rebakes from the original and drops the previous rendition", () => {
    const plan = planListingPhotoToneSave({
      publicUrl: BAKED,
      publicThumbnailUrl: BAKED_THUMB,
      requested: { brightness: 30, highlights: 0, shadows: 0, contrast: 0 },
      recipe: recipe(),
    })
    assert.equal(plan.action, "bake")
    if (plan.action !== "bake") return
    assert.equal(plan.sourceUrl, ORIGINAL)
    assert.equal(plan.removeUrls.includes(BAKED), true)
    assert.equal(plan.removeUrls.includes(ORIGINAL), false)
    assert.equal(plan.removeUrls.includes(ORIGINAL_THUMB), false)
  })

  it("skips a save that matches the current recipe", () => {
    const plan = planListingPhotoToneSave({
      publicUrl: BAKED,
      publicThumbnailUrl: BAKED_THUMB,
      requested: recipe().tone,
      recipe: recipe(),
    })
    assert.deepEqual(plan, {
      action: "skip",
      url: BAKED,
      thumbnailUrl: BAKED_THUMB,
      sourceUrl: ORIGINAL,
      tone: recipe().tone,
    })
  })

  it("restores the original and drops the rendition when the sliders return to zero", () => {
    const plan = planListingPhotoToneSave({
      publicUrl: BAKED,
      publicThumbnailUrl: BAKED_THUMB,
      requested: LISTING_PHOTO_TONE_IDENTITY,
      recipe: recipe(),
    })
    assert.equal(plan.action, "restore")
    if (plan.action !== "restore") return
    assert.equal(plan.sourceUrl, ORIGINAL)
    assert.equal(plan.removeUrls.includes(BAKED), true)
    assert.equal(plan.removeUrls.includes(ORIGINAL), false)
  })

  it("bakes a replaced photo from the new upload and drops the old rendition", () => {
    const plan = planListingPhotoToneSave({
      publicUrl: REPLACED,
      publicThumbnailUrl: REPLACED_THUMB,
      requested: { brightness: 8, highlights: 0, shadows: 0, contrast: 0 },
      recipe: recipe(),
    })
    assert.equal(plan.action, "bake")
    if (plan.action !== "bake") return
    assert.equal(plan.sourceUrl, REPLACED)
    assert.equal(plan.removeUrls.includes(BAKED), true)
    assert.equal(plan.removeUrls.includes(REPLACED), false)
    assert.equal(plan.removeUrls.includes(ORIGINAL), false)
    assert.equal(plan.removeUrls.includes(ORIGINAL_THUMB), false)
  })

  it("does not point a replaced photo back at the older upload", () => {
    const plan = planListingPhotoToneSave({
      publicUrl: REPLACED,
      publicThumbnailUrl: REPLACED_THUMB,
      requested: LISTING_PHOTO_TONE_IDENTITY,
      recipe: recipe(),
    })
    assert.equal(plan.action, "skip")
  })
})

describe("listingPhotoTone helpers", () => {
  it("compares clamped stops", () => {
    assert.equal(
      listingPhotoTonesEqual({ brightness: 1.2, highlights: 0, shadows: 0, contrast: 0 }, {
        brightness: 1,
        highlights: 0,
        shadows: 0,
        contrast: 0,
      }),
      true,
    )
    assert.equal(clampListingPhotoTone({ brightness: 4 }).brightness, 4)
  })

  it("reads a recipe row and ignores an incomplete one", () => {
    const parsed = listingPhotoToneRecipeFromRow({
      source_url: ORIGINAL,
      source_thumbnail_url: ORIGINAL_THUMB,
      rendition_url: BAKED,
      rendition_thumbnail_url: BAKED_THUMB,
      brightness: "20",
      highlights: 0,
      shadows: "10",
      contrast: 0,
    })
    assert.equal(parsed?.sourceUrl, ORIGINAL)
    assert.equal(parsed?.tone.brightness, 20)
    assert.equal(listingPhotoToneRecipeFromRow({ source_url: ORIGINAL }), null)
  })

  it("parses active recipes from the editor payload", () => {
    const parsed = parseListingPhotoToneActiveRecipes({
      data: {
        images: [
          { id: "img-1", sourceUrl: ` ${ORIGINAL} `, brightness: 12, highlights: 0, shadows: 0, contrast: 0 },
          { id: "img-2", sourceUrl: ORIGINAL, brightness: 0, highlights: 0, shadows: 0, contrast: 0 },
          { id: "", sourceUrl: ORIGINAL, brightness: 4, highlights: 0, shadows: 0, contrast: 0 },
        ],
      },
    })
    assert.deepEqual(parsed, [
      {
        id: "img-1",
        sourceUrl: ORIGINAL,
        tone: { brightness: 12, highlights: 0, shadows: 0, contrast: 0 },
      },
    ])
    assert.deepEqual(parseListingPhotoToneActiveRecipes(null), [])
  })

  it("builds proxy-safe derivative paths", () => {
    const ownerId = "11111111-1111-4111-8111-111111111111"
    const imageId = "22222222-2222-4222-8222-222222222222"
    const paths = listingPhotoToneStoragePaths(ownerId, "m5k2a0", imageId)
    assert.equal(paths.full.endsWith("-full.webp"), true)
    assert.equal(paths.card.includes("-card2."), true)
    assert.equal(paths.film.includes("-film2."), true)
    for (const path of Object.values(paths)) {
      assert.equal(isValidListingMediaObjectPath(path), true)
    }
  })

})
