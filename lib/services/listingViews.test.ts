import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

function readRepo(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8")
}

describe("mobile listing GET view recording", () => {
  it("kicks off recordPublicListingView without awaiting it before listing JSON", () => {
    const src = readRepo("app/api/mobile/v1/listings/[id]/route.ts")
    const recordAt = src.indexOf("recordPublicListingView(")
    const responseAt = src.lastIndexOf("return mobileDataResponse(")
    assert.ok(recordAt > -1, "signed-in GET still records a public listing view")
    assert.ok(responseAt > recordAt, "recording is scheduled before the JSON response")
    assert.doesNotMatch(src, /await recordPublicListingView\(/)
    assert.match(src, /\bafter\(/)
    assert.match(src, /\.catch\(/)
  })
})
