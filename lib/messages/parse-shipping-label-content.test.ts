import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseShippingLabelMessageContent } from "./parse-shipping-label-content.ts"
import { parseOrderShippedMessageContent } from "./parse-order-shipped-content.ts"

const LEGACY_ADMIN = `Reswell (admin): shipping materials for order #939QLS — 5’8 Hayden Shapes White Noiz

Label (PDF): https://api.shipengine.com/v1/downloads/14/tvr4HMokqUyJcb73ZgPjhA/label-196282462.pdf
Tracking: 1Z19AK150307816357
Carrier: ups · ups_ground

Seller: print the label or open the USPS QR code on your sale page (when available), pack the item, and hand it to the carrier. Use your sale page to confirm when it’s dropped off.
Buyer: this tracking number is on your order page. The seller confirms shipment after drop-off; then delivery protection and payout timing follow the normal flow.`

const LEGACY_READY = `Reswell: shipping label ready for order #939QLS — 5'8 Hayden Shapes White Noiz

Tracking: 1Z19AK150307816357
Carrier: ups

Seller: open your sale page to view or download the label PDF, print it, and drop the package with the carrier.
Buyer: this tracking number is on your purchase page.`

const CLEAN_COPY = `Shipping label ready — order #939QLS
5'8 Hayden Shapes White Noiz
Tracking 1Z19AK150307816357 · UPS Ground`

const LEGACY_SHIPPED = `Shipped — tracking for "5'8 Hayden Shapes White Noiz":
Carrier: ups
Tracking #: 1Z19AK150307816357

Funds stay on hold until the carrier reports delivery on Reswell tracking, then release automatically after a 24-hour review window.`

describe("parseShippingLabelMessageContent", () => {
  it("parses the legacy admin wall-of-text", () => {
    const parsed = parseShippingLabelMessageContent(LEGACY_ADMIN)
    assert.ok(parsed)
    assert.equal(parsed.source, "admin")
    assert.equal(parsed.orderNum, "939QLS")
    assert.equal(parsed.listingTitle, "5’8 Hayden Shapes White Noiz")
    assert.equal(parsed.trackingNumber, "1Z19AK150307816357")
    assert.equal(parsed.trackingCarrier, "ups · ups_ground")
    assert.equal(
      parsed.labelPdfUrl,
      "https://api.shipengine.com/v1/downloads/14/tvr4HMokqUyJcb73ZgPjhA/label-196282462.pdf",
    )
    assert.equal(parsed.hasPaperlessQr, true)
  })

  it("parses the legacy auto-label message", () => {
    const parsed = parseShippingLabelMessageContent(LEGACY_READY)
    assert.ok(parsed)
    assert.equal(parsed.source, "reswell")
    assert.equal(parsed.orderNum, "939QLS")
    assert.equal(parsed.trackingNumber, "1Z19AK150307816357")
    assert.equal(parsed.trackingCarrier, "ups")
    assert.equal(parsed.labelPdfUrl, null)
  })

  it("parses the clean stored copy", () => {
    const parsed = parseShippingLabelMessageContent(CLEAN_COPY)
    assert.ok(parsed)
    assert.equal(parsed.orderNum, "939QLS")
    assert.equal(parsed.listingTitle, "5'8 Hayden Shapes White Noiz")
    assert.equal(parsed.trackingNumber, "1Z19AK150307816357")
    assert.equal(parsed.trackingCarrier, "UPS Ground")
  })

  it("ignores ordinary chat", () => {
    assert.equal(parseShippingLabelMessageContent("Can you ship this week?"), null)
  })
})

describe("parseOrderShippedMessageContent", () => {
  it("parses the legacy shipped bubble", () => {
    const parsed = parseOrderShippedMessageContent(LEGACY_SHIPPED)
    assert.ok(parsed)
    assert.equal(parsed.listingTitle, "5'8 Hayden Shapes White Noiz")
    assert.equal(parsed.trackingNumber, "1Z19AK150307816357")
    assert.equal(parsed.trackingCarrier, "ups")
  })

  it("parses the clean shipped copy", () => {
    const parsed = parseOrderShippedMessageContent(
      "Your order shipped — 5'8 Hayden Shapes White Noiz\nTracking 1Z19AK150307816357 · UPS",
    )
    assert.ok(parsed)
    assert.equal(parsed.listingTitle, "5'8 Hayden Shapes White Noiz")
    assert.equal(parsed.trackingNumber, "1Z19AK150307816357")
    assert.equal(parsed.trackingCarrier, "UPS")
  })
})
