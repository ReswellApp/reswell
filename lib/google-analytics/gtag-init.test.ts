import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { GA4_EVENTS_NEVER_IMPORT_AS_ADS_CONVERSIONS } from "../google-ads/config.ts"
import {
  buildGoogleAnalyticsConfigCommand,
  GA4_GTAG_CONFIG,
  GA4_GTAG_GROUP,
} from "./gtag-init.ts"

describe("GA4 gtag init", () => {
  it("routes analytics to the ga4 group so Ads does not treat auto-events as conversions", () => {
    assert.equal(GA4_GTAG_GROUP, "ga4")
    assert.equal(GA4_GTAG_CONFIG.groups, "ga4")

    const command = buildGoogleAnalyticsConfigCommand("G-TESTMEASURE")
    assert.match(command, /gtag\('config', 'G-TESTMEASURE'/)
    assert.match(command, /"groups":"ga4"/)
    assert.doesNotMatch(command, /AW-/)
  })

  it("does not name blocked Ads-import events in the GA4 config command", () => {
    const command = buildGoogleAnalyticsConfigCommand("G-TESTMEASURE")
    for (const eventName of GA4_EVENTS_NEVER_IMPORT_AS_ADS_CONVERSIONS) {
      assert.doesNotMatch(command, new RegExp(`['"]${eventName}['"]`))
    }
  })
})
