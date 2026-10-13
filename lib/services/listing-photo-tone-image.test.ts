import assert from "node:assert/strict"
import { describe, it } from "node:test"
import sharp from "sharp"
import { LISTING_PHOTO_TONE_IDENTITY } from "@/lib/utils/listing-photo-tone"
import { renderListingPhotoToneDerivatives } from "./listing-photo-tone-image.ts"

async function grayWebp(value: number, width = 32, height = 48): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: value, g: value, b: value },
    },
  })
    .webp()
    .toBuffer()
}

async function meanLuma(bytes: Buffer): Promise<number> {
  const stats = await sharp(bytes).stats()
  return stats.channels[0]?.mean ?? 0
}

describe("renderListingPhotoToneDerivatives", () => {
  it("writes a brighter full photo and the listing derivative sizes", async () => {
    const source = await grayWebp(90, 800, 1200)
    const baked = await renderListingPhotoToneDerivatives(source, {
      ...LISTING_PHOTO_TONE_IDENTITY,
      brightness: 50,
      shadows: 20,
    })

    const sourceMean = await meanLuma(source)
    const fullMean = await meanLuma(baked.full)
    assert.ok(fullMean > sourceMean + 5)

    const [fullMeta, thumbMeta, cardMeta, filmMeta] = await Promise.all([
      sharp(baked.full).metadata(),
      sharp(baked.thumb).metadata(),
      sharp(baked.card).metadata(),
      sharp(baked.film).metadata(),
    ])
    assert.equal(fullMeta.format, "webp")
    assert.equal(fullMeta.height, 1200)
    assert.equal(thumbMeta.height, 640)
    assert.equal(cardMeta.height, 960)
    assert.equal(filmMeta.height, 400)
  })

  it("pulls a bright frame down when highlights go negative", async () => {
    const source = await grayWebp(220)
    const baked = await renderListingPhotoToneDerivatives(source, {
      ...LISTING_PHOTO_TONE_IDENTITY,
      highlights: -60,
    })
    const sourceMean = await meanLuma(source)
    const fullMean = await meanLuma(baked.full)
    assert.ok(fullMean < sourceMean - 5)
  })
})
