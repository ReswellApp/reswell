import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isBlockedOfficialSiteHost,
  isSafePublicHttpsUrl,
  officialSiteTextMentionsModel,
} from "./listing-brand-model-official-site.ts"

describe("official site safety", () => {
  it("blocks retailers, social, and private hosts", () => {
    assert.equal(isSafePublicHttpsUrl("https://instagram.com/foo"), false)
    assert.equal(isSafePublicHttpsUrl("https://www.amazon.com/dp/1"), false)
    assert.equal(isSafePublicHttpsUrl("https://surfline.com/shop"), false)
    assert.equal(isSafePublicHttpsUrl("http://barahonasurfboards.com"), false)
    assert.equal(isSafePublicHttpsUrl("https://127.0.0.1/"), false)
    assert.equal(isSafePublicHttpsUrl("https://barahonasurfboards.com/"), true)
  })

  it("flags blocked hostnames", () => {
    assert.equal(isBlockedOfficialSiteHost("ccs.com"), true)
    assert.equal(isBlockedOfficialSiteHost("barahonasurfboards.com"), false)
  })
})

describe("officialSiteTextMentionsModel", () => {
  it("finds a whole-word model name in page text", () => {
    assert.equal(
      officialSiteTextMentionsModel("The Twin Pin is our everyday fish.", "Twin Pin"),
      true,
    )
    assert.equal(officialSiteTextMentionsModel("The Twin is our fish.", "Twin Pin"), false)
  })
})
