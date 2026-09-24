import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { newsletterPromoEventProperties } from "./newsletter-promo-event-properties.ts"

describe("newsletterPromoEventProperties", () => {
  it("includes the code and discount the welcome flow renders", () => {
    const properties = newsletterPromoEventProperties({
      email: "surfer@example.com",
      promoCode: "WELCOME-K7M3NP",
      discountPercent: 15,
      expiresAt: "2026-10-24T00:00:00.000Z",
      isNewCode: true,
      shopOrigin: "https://www.reswell.app",
    })

    assert.equal(properties.promo_code, "WELCOME-K7M3NP")
    assert.equal(properties.discount_percent, 15)
    assert.equal(properties.discount_label, "15% off")
    assert.equal(properties.expires_at_formatted, "October 24, 2026")
    assert.equal(properties.is_new_code, true)
    assert.match(String(properties.shop_url), /\/boards$/)
  })
})
