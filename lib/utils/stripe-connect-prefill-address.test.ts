import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  addressRowLooksLikeUsPoBox,
  isStripePrefillAddressRejection,
  isUsPoBoxStreetLine,
} from "./stripe-connect-prefill-address.ts"

describe("isUsPoBoxStreetLine", () => {
  it("detects common PO Box spellings", () => {
    assert.equal(isUsPoBoxStreetLine("PO Box 123"), true)
    assert.equal(isUsPoBoxStreetLine("P.O. Box 123"), true)
    assert.equal(isUsPoBoxStreetLine("P.O.Box 88"), true)
    assert.equal(isUsPoBoxStreetLine("Post Office Box 456"), true)
    assert.equal(isUsPoBoxStreetLine("POBOX 789"), true)
    assert.equal(isUsPoBoxStreetLine("POB 12"), true)
    assert.equal(isUsPoBoxStreetLine("Box 321"), true)
  })

  it("leaves real street addresses alone", () => {
    assert.equal(isUsPoBoxStreetLine("123 Main Street"), false)
    assert.equal(isUsPoBoxStreetLine("14 Boxwood Lane"), false)
    assert.equal(isUsPoBoxStreetLine("RR 1 Box 12"), false)
    assert.equal(isUsPoBoxStreetLine(""), false)
    assert.equal(isUsPoBoxStreetLine(null), false)
  })
})

describe("addressRowLooksLikeUsPoBox", () => {
  it("checks line1 and line2", () => {
    assert.equal(
      addressRowLooksLikeUsPoBox({ line1: "PO Box 99", line2: null }),
      true,
    )
    assert.equal(
      addressRowLooksLikeUsPoBox({ line1: "c/o Shop", line2: "P.O. Box 10" }),
      true,
    )
    assert.equal(
      addressRowLooksLikeUsPoBox({ line1: "100 Ocean Ave", line2: "Apt 2" }),
      false,
    )
  })
})

describe("isStripePrefillAddressRejection", () => {
  it("matches Stripe’s PO Box invalid-request shape", () => {
    assert.equal(
      isStripePrefillAddressRejection({
        param: "individual[address]",
        message: "Address can't be a Post Office Box (PO Box). Provide a physical address.",
      }),
      true,
    )
    assert.equal(
      isStripePrefillAddressRejection({
        param: "business_profile.url",
        message: "Invalid URL",
      }),
      false,
    )
  })
})
