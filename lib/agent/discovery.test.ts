import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildLlmsTxt } from "./llms-txt.ts"
import { listingAgentLinkHeader } from "./listing-agent-links.ts"

describe("agent discovery documents", () => {
  it("tells agents how to filter search and where photos live", () => {
    const body = buildLlmsTxt("https://www.reswell.app", { activeListingCount: 1200 })
    assert.match(body, /Live public listings right now: 1200/)
    assert.match(body, /brand=\{brand\}&model=\{model\}/)
    assert.match(body, /&city=\{city\}/)
    assert.match(body, /image_urls/)
    assert.match(body, /describedby/)
  })

  it("points a listing document at its JSON twin and llms.txt", () => {
    const header = listingAgentLinkHeader("https://www.reswell.app/", "ci twin/pin")
    assert.match(
      header,
      /<https:\/\/www\.reswell\.app\/api\/public\/listings\/ci%20twin%2Fpin>; rel="alternate"; type="application\/json"/,
    )
    assert.match(header, /<https:\/\/www\.reswell\.app\/llms\.txt>; rel="describedby"; type="text\/plain"/)
  })
})
