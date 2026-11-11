import assert from "node:assert/strict"
import { describe, it } from "node:test"
import sharp from "sharp"
import {
  clampStampCropBox,
  cropStampPhotoForVision,
  padStampCropBox,
} from "./crop-stamp-photo.ts"

describe("stamp crop box", () => {
  it("rejects tiny or invalid boxes and clamps overflow", () => {
    assert.equal(clampStampCropBox(null), null)
    assert.equal(clampStampCropBox({ x: 0.1, y: 0.1, width: 0.01, height: 0.4 }), null)
    const clamped = clampStampCropBox({ x: 0.8, y: 0.8, width: 0.5, height: 0.5 })
    assert.ok(clamped)
    assert.ok(clamped.x + clamped.width <= 1.0001)
    assert.ok(clamped.y + clamped.height <= 1.0001)
  })

  it("pads without leaving 0–1", () => {
    const padded = padStampCropBox({ x: 0.1, y: 0.2, width: 0.2, height: 0.2 }, 0.5)
    assert.ok(padded.x >= 0)
    assert.ok(padded.y >= 0)
    assert.ok(padded.x + padded.width <= 1.0001)
    assert.ok(padded.y + padded.height <= 1.0001)
  })

  it("extracts a JPEG crop from a listing-sized photo", async () => {
    const source = await sharp({
      create: {
        width: 400,
        height: 600,
        channels: 3,
        background: { r: 200, g: 200, b: 200 },
      },
    })
      .jpeg()
      .toBuffer()

    const cropped = await cropStampPhotoForVision(new Uint8Array(source), {
      x: 0.2,
      y: 0.3,
      width: 0.4,
      height: 0.25,
    })
    assert.ok(cropped)
    assert.equal(cropped.mediaType, "image/jpeg")
    const meta = await sharp(cropped.bytes).metadata()
    assert.ok((meta.width ?? 0) >= 48)
    assert.ok((meta.height ?? 0) >= 48)
    assert.ok((meta.width ?? 9999) < 400)
  })
})
