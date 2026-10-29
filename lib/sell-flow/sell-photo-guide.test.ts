import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { SELL_PHOTO_GUIDE_EXAMPLES } from "./sell-photo-guide.ts"

describe("SELL_PHOTO_GUIDE_EXAMPLES", () => {
  it("has six labeled shots from the Quadratic Formula listing", () => {
    assert.equal(SELL_PHOTO_GUIDE_EXAMPLES.length, 6)
    const ids = SELL_PHOTO_GUIDE_EXAMPLES.map((example) => example.id)
    assert.deepEqual(ids, ["primary", "bottom", "rails", "tail-fins", "size-scale", "imperfections"])
    for (const example of SELL_PHOTO_GUIDE_EXAMPLES) {
      assert.match(example.path, /^\/media\/listings\/ab98fbb1-0c49-49e1-9483-a1c4a286c8e2\/.+-card2\.webp$/)
      assert.ok(example.label.trim().length > 0)
    }
  })
})
