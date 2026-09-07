import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildGoogleAdsConfigCommand, GOOGLE_ADS_GTAG_CONFIG } from "./gtag-init.ts"

describe("Google Ads gtag init", () => {
  it("does not send AW page views (those mix into Purchase goals)", () => {
    assert.equal(GOOGLE_ADS_GTAG_CONFIG.send_page_view, false)
    assert.equal(GOOGLE_ADS_GTAG_CONFIG.conversion_linker, true)
  })

  it("configs the AW id only — never a conversion label on every page", () => {
    const command = buildGoogleAdsConfigCommand("AW-18062254229")
    assert.match(command, /gtag\('config', 'AW-18062254229'/)
    assert.doesNotMatch(command, /AW-18062254229\//)
    assert.match(command, /"send_page_view":false/)
    assert.match(command, /"groups":"ads"/)
  })
})
