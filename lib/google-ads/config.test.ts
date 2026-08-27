import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import {
  GA4_EVENTS_NEVER_IMPORT_AS_ADS_CONVERSIONS,
  GA4_PURCHASE_EVENT_FOR_ADS_IMPORT,
  getGoogleAdsAwId,
  getGoogleAdsPurchaseConversionSendTo,
  isGa4PurchaseImportedAsAdsConversion,
} from "./config.ts"

const PREV_CONVERSION = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION
const PREV_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
const PREV_SIGNUP = process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_CONVERSION
const PREV_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION_LABEL
const PREV_GA4_IMPORT = process.env.NEXT_PUBLIC_GOOGLE_ADS_IMPORT_GA4_PURCHASE

describe("Google Ads conversion ids", () => {
  afterEach(() => {
    restore("NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION", PREV_CONVERSION)
    restore("NEXT_PUBLIC_GOOGLE_ADS_ID", PREV_ID)
    restore("NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_CONVERSION", PREV_SIGNUP)
    restore("NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION_LABEL", PREV_LABEL)
    restore("NEXT_PUBLIC_GOOGLE_ADS_IMPORT_GA4_PURCHASE", PREV_GA4_IMPORT)
  })

  it("keeps the AW config id separate from the purchase conversion label", () => {
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = "AW-18062254229"
    process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION =
      "AW-18062254229/FsjrCPnlwbAcEJXB4KRD"
    delete process.env.NEXT_PUBLIC_GOOGLE_ADS_IMPORT_GA4_PURCHASE

    const awId = getGoogleAdsAwId()
    const purchase = getGoogleAdsPurchaseConversionSendTo()

    assert.equal(awId, "AW-18062254229")
    assert.equal(purchase, "AW-18062254229/FsjrCPnlwbAcEJXB4KRD")
    assert.notEqual(awId, purchase)
    assert.ok(purchase?.startsWith(`${awId}/`))
  })

  it("rejects a conversion label used as the site-wide AW id", () => {
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = "AW-18062254229/FsjrCPnlwbAcEJXB4KRD"
    process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION =
      "AW-18062254229/FsjrCPnlwbAcEJXB4KRD"

    assert.equal(getGoogleAdsAwId(), "AW-18062254229")
  })

  it("turns off the website purchase tag when GA4 purchase is imported", () => {
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = "AW-18062254229"
    process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION =
      "AW-18062254229/FsjrCPnlwbAcEJXB4KRD"
    process.env.NEXT_PUBLIC_GOOGLE_ADS_IMPORT_GA4_PURCHASE = "true"

    assert.equal(isGa4PurchaseImportedAsAdsConversion(), true)
    assert.equal(getGoogleAdsPurchaseConversionSendTo(), null)
    assert.equal(getGoogleAdsAwId(), "AW-18062254229")
  })

  it("never imports page_view, add_to_cart, session_start, or user_engagement", () => {
    assert.deepEqual([...GA4_EVENTS_NEVER_IMPORT_AS_ADS_CONVERSIONS], [
      "page_view",
      "add_to_cart",
      "session_start",
      "user_engagement",
    ])
    assert.equal(GA4_PURCHASE_EVENT_FOR_ADS_IMPORT, "purchase")
  })
})

function restore(name: string, previous: string | undefined): void {
  if (previous === undefined) delete process.env[name]
  else process.env[name] = previous
}
