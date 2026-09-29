import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  redactShippingLabelArtifactsFromMessage,
  shippingLabelOrderIdFromMessage,
} from "./redact-seller-shipping-label.ts"

const ORDER_ID = "7f3c1a90-4e2b-4d8a-9f11-2c6e8b4a1d05"

describe("redactShippingLabelArtifactsFromMessage", () => {
  it("strips the label PDF url and paperless flag the seller would download", () => {
    const redacted = redactShippingLabelArtifactsFromMessage({
      content: "Shipping label ready — order #1042\nhttps://api.shipengine.com/v1/labels/abc.pdf",
      metadata: {
        kind: "admin_shipping_label",
        orderId: ORDER_ID,
        labelPdfUrl: "https://api.shipengine.com/v1/labels/abc.pdf",
        hasPaperlessQr: true,
        trackingNumber: "940011189922",
      },
    })

    assert.equal(redacted.metadata && typeof redacted.metadata === "object"
      ? (redacted.metadata as { labelPdfUrl?: string | null }).labelPdfUrl
      : "missing", null)
    assert.equal(
      redacted.metadata && typeof redacted.metadata === "object"
        ? (redacted.metadata as { hasPaperlessQr?: boolean }).hasPaperlessQr
        : true,
      false,
    )
    assert.equal(redacted.content?.includes("shipengine"), false)
    assert.match(redacted.content ?? "", /940011189922|Shipping label ready/)
    assert.equal(shippingLabelOrderIdFromMessage(redacted), ORDER_ID)
  })

  it("leaves ordinary messages unchanged", () => {
    const message = { content: "Can you ship this week?", metadata: null }
    assert.equal(redactShippingLabelArtifactsFromMessage(message), message)
    assert.equal(shippingLabelOrderIdFromMessage(message), null)
  })
})
