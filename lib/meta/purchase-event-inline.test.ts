import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"

import { buildMetaPurchaseInlineScript } from "./purchase-event-inline.ts"

const PIXEL_ID = "123456789012345"
const priorPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID

describe("buildMetaPurchaseInlineScript", () => {
  before(() => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = PIXEL_ID
  })

  after(() => {
    if (priorPixelId == null) delete process.env.NEXT_PUBLIC_META_PIXEL_ID
    else process.env.NEXT_PUBLIC_META_PIXEL_ID = priorPixelId
  })

  it("inlines a valid ISO currency even when the order passes a symbol", () => {
    const script = buildMetaPurchaseInlineScript({
      orderId: "ord_1",
      value: 88.1,
      currency: "$",
      contentIds: ["listing-1"],
    })
    assert.ok(script)
    assert.match(script, /var currency = 'USD';/)
    assert.match(script, /fbq\('track', 'Purchase', params, \{ eventID: eventId \}\)/)
  })

  it("keeps a real ISO code", () => {
    const script = buildMetaPurchaseInlineScript({
      orderId: "ord_1",
      value: 20,
      currency: "eur",
    })
    assert.ok(script)
    assert.match(script, /var currency = 'EUR';/)
  })
})
