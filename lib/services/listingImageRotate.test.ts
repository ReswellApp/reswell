import assert from "node:assert/strict"
import { describe, it } from "node:test"
import sharp from "sharp"
import { renderRotatedListingDerivatives } from "../media/rotate-listing-derivatives.ts"

describe("renderRotatedListingDerivatives", () => {
  it("auto-orients and turns a wide photo onto its side", async () => {
    const source = await sharp({
      create: {
        width: 80,
        height: 40,
        channels: 3,
        background: { r: 20, g: 90, b: 160 },
      },
    })
      .jpeg()
      .toBuffer()

    const turned = await renderRotatedListingDerivatives(source, 1)
    const meta = await sharp(turned.full).metadata()
    assert.equal(meta.width, 40)
    assert.equal(meta.height, 80)
    assert.equal(meta.format, "webp")

    const half = await renderRotatedListingDerivatives(source, 2)
    const halfMeta = await sharp(half.thumb).metadata()
    assert.equal(halfMeta.width, 80)
    assert.equal(halfMeta.height, 40)
  })
})
