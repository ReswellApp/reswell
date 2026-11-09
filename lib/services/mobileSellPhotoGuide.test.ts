import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { SELL_PHOTO_GUIDE_EXAMPLES } from "@/lib/sell-flow/sell-photo-guide"
import { getMobileSellPhotoGuide } from "@/lib/services/mobileSellPhotoGuide"

describe("getMobileSellPhotoGuide", () => {
  it("returns the same six example shots as website /sell", () => {
    const guide = getMobileSellPhotoGuide()
    assert.equal(guide.examples.length, SELL_PHOTO_GUIDE_EXAMPLES.length)
    for (const [index, example] of guide.examples.entries()) {
      const source = SELL_PHOTO_GUIDE_EXAMPLES[index]
      assert.ok(source)
      assert.equal(example.id, source.id)
      assert.equal(example.label, source.label)
      assert.ok(example.image_url.endsWith(source.path))
      assert.match(example.image_url, /^https:\/\//)
    }
  })
})
