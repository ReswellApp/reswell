import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { sniffSellPhotoMatchMime } from "./sell-photo-match.ts"

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
