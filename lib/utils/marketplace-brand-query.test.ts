import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  extractMarketplaceSectionIntent,
  marketplaceSectionIntentIsBrandNameToken,
} from "./marketplace-brand-query.ts"

describe("marketplace section intent vs brand names", () => {
  it("still scopes qualifier searches like channel islands fins", () => {
    assert.equal(extractMarketplaceSectionIntent("channel islands fins"), "fins")
    assert.equal(
      marketplaceSectionIntentIsBrandNameToken("fins", "Channel Islands"),
      false,
    )
  })

  it("does not treat Captain Fin as a fins-section browse", () => {
    assert.equal(extractMarketplaceSectionIntent("captain fin"), "fins")
    assert.equal(
      marketplaceSectionIntentIsBrandNameToken("fins", "Captain Fin"),
      true,
    )
  })

  it("does not treat Lost Surfboards as a surfboards-section browse", () => {
    assert.equal(extractMarketplaceSectionIntent("lost surfboards"), "surfboards")
    assert.equal(
      marketplaceSectionIntentIsBrandNameToken("surfboards", "Lost Surfboards"),
      true,
    )
  })

  it("keeps section scope when the brand name has no section token", () => {
    assert.equal(
      marketplaceSectionIntentIsBrandNameToken("fins", "Lost Surfboards"),
      false,
    )
  })
})
