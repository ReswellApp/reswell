import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { shouldTrackPublicPageView } from "./public-page-view.ts"

describe("shouldTrackPublicPageView", () => {
  it("tracks public storefront paths", () => {
    assert.equal(shouldTrackPublicPageView("/"), true)
    assert.equal(shouldTrackPublicPageView("/boards"), true)
    assert.equal(shouldTrackPublicPageView("/sell/new"), true)
  })

  it("skips admin and invalid paths", () => {
    assert.equal(shouldTrackPublicPageView("/admin"), false)
    assert.equal(shouldTrackPublicPageView("/admin/orders"), false)
    assert.equal(shouldTrackPublicPageView(""), false)
    assert.equal(shouldTrackPublicPageView(null), false)
    assert.equal(shouldTrackPublicPageView("boards"), false)
  })
})
