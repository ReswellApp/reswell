import assert from "node:assert/strict"
import { describe, it } from "node:test"
import sharp from "sharp"
import {
  computeImageDhash,
  dhashFromGrayscale9x8,
  minPhashDistanceToQueries,
  phashHammingDistance,
} from "./image-phash.ts"

function gradient9x8(flip = false): Uint8Array {
  const pixels = new Uint8Array(72)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 9; x++) {
      const value = Math.round((x / 8) * 255)
      pixels[y * 9 + x] = flip ? 255 - value : value
    }
  }
  return pixels
}

describe("dimension photo dHash", () => {
  it("encodes 64 bits as 16 hex chars", () => {
    const hash = dhashFromGrayscale9x8(gradient9x8())
    assert.match(hash, /^[0-9a-f]{16}$/)
  })

  it("is 0 for identical hashes and high for inverted gradients", () => {
    const left = dhashFromGrayscale9x8(gradient9x8())
    const right = dhashFromGrayscale9x8(gradient9x8(true))
    assert.equal(phashHammingDistance(left, left), 0)
    assert.ok(phashHammingDistance(left, right) >= 32)
    assert.equal(phashHammingDistance(left, null), 64)
    assert.equal(minPhashDistanceToQueries(left, [right, left]), 0)
    assert.equal(minPhashDistanceToQueries(null, [left]), 65)
  })

  it("hashes identical photos as 0 and splits horizontal vs vertical stripes", async () => {
    const horizontal = await sharp({
      create: {
        width: 72,
        height: 64,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite(
        [0, 16, 32, 48].map((top) => ({
          input: { create: { width: 72, height: 8, channels: 3, background: { r: 0, g: 0, b: 0 } } },
          top,
          left: 0,
        })),
      )
      .jpeg()
      .toBuffer()
    const vertical = await sharp({
      create: {
        width: 72,
        height: 64,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite(
        [0, 18, 36, 54].map((left) => ({
          input: { create: { width: 8, height: 64, channels: 3, background: { r: 0, g: 0, b: 0 } } },
          top: 0,
          left,
        })),
      )
      .jpeg()
      .toBuffer()

    const a = await computeImageDhash(new Uint8Array(horizontal))
    const a2 = await computeImageDhash(new Uint8Array(horizontal))
    const b = await computeImageDhash(new Uint8Array(vertical))
    assert.ok(a && a2 && b)
    assert.equal(phashHammingDistance(a, a2), 0)
    assert.ok(phashHammingDistance(a, b) > 0)
  })
})
