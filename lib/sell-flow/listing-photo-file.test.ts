import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  canonicalDeclaredMime,
  extensionMime,
  isListingPhotoFile,
  mimeForImageDecode,
  normalizeListingImageFile,
  sniffImageMime,
} from "./listing-photo-file.ts"

function file(name: string, type: string, bytes?: number[]): File {
  const body = bytes ? Uint8Array.from(bytes) : Uint8Array.from([0, 0, 0, 0])
  return new File([body], name, { type })
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const HEIC = [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]

describe("listing photo file types", () => {
  it("canonicalizes Windows JPEG MIME aliases", () => {
    assert.equal(canonicalDeclaredMime("image/jpg"), "image/jpeg")
    assert.equal(canonicalDeclaredMime("image/pjpeg"), "image/jpeg")
    assert.equal(canonicalDeclaredMime("IMAGE/JPEG; charset=binary"), "image/jpeg")
    assert.equal(canonicalDeclaredMime(""), "")
  })

  it("maps Windows photo extensions", () => {
    assert.equal(extensionMime("scan.jfif"), "image/jpeg")
    assert.equal(extensionMime("photo.JFIF"), "image/jpeg")
    assert.equal(extensionMime("shot.bmp"), "image/bmp")
    assert.equal(extensionMime("board.tiff"), "image/tiff")
    assert.equal(extensionMime("IMG_1.HEIC"), "image/heic")
    assert.equal(extensionMime("notes.pdf"), null)
  })

  it("accepts extension-only files Windows leaves with an empty type", () => {
    assert.equal(isListingPhotoFile(file("scan.jfif", "")), true)
    assert.equal(isListingPhotoFile(file("photo.jpg", "")), true)
    assert.equal(isListingPhotoFile(file("shot.bmp", "")), true)
    assert.equal(isListingPhotoFile(file("IMG.HEIC", "")), true)
    assert.equal(isListingPhotoFile(file("board.tif", "application/octet-stream")), true)
  })

  it("accepts non-standard image MIME types and rejects SVG", () => {
    assert.equal(isListingPhotoFile(file("a.jpg", "image/jpg")), true)
    assert.equal(isListingPhotoFile(file("a.jpg", "image/pjpeg")), true)
    assert.equal(isListingPhotoFile(file("icon.svg", "image/svg+xml")), false)
    assert.equal(isListingPhotoFile(file("clip.mp4", "video/mp4")), false)
  })

  it("sniffs JPEG, PNG, and HEIC headers", () => {
    assert.equal(sniffImageMime(Uint8Array.from(JPEG)), "image/jpeg")
    assert.equal(sniffImageMime(Uint8Array.from(PNG)), "image/png")
    assert.equal(sniffImageMime(Uint8Array.from(HEIC)), "image/heic")
  })

  it("stamps an extension MIME when Windows omits the type", () => {
    assert.equal(mimeForImageDecode("", "photo.png"), "image/png")
    assert.equal(mimeForImageDecode("image/jpg", "photo.jpg"), "image/jpeg")
    assert.equal(mimeForImageDecode("application/octet-stream", "scan.jfif"), "image/jpeg")
  })

  it("retypes image/jpg files as image/jpeg", async () => {
    const normalized = await normalizeListingImageFile(file("photo.jpg", "image/jpg", JPEG))
    assert.equal(normalized.type, "image/jpeg")
  })

  it("trusts HEIC bytes even when the file is named .jpg", async () => {
    const normalized = await normalizeListingImageFile(file("IMG.jpg", "image/jpeg", HEIC))
    assert.equal(normalized.type, "image/heic")
  })

  it("does not copy an empty-type JPEG just to stamp a MIME", async () => {
    const original = file("photo.jpg", "", JPEG)
    const normalized = await normalizeListingImageFile(original)
    assert.equal(normalized, original)
  })

  it("trusts PNG bytes when Windows leaves the type empty and the name is .jpg", async () => {
    const normalized = await normalizeListingImageFile(file("photo.jpg", "", PNG))
    assert.equal(normalized.type, "image/png")
  })

  it("does not copy an iPhone HEIC whose extension already says HEIC", async () => {
    const original = file("IMG.HEIC", "", HEIC)
    const normalized = await normalizeListingImageFile(original)
    assert.equal(normalized, original)
  })
})
