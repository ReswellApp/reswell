import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { ShippingAddressFormInput } from "./address-input.ts"
import {
  checkoutAddressDraftFingerprint,
  isCheckoutAddressDraftReadyToSave,
} from "./checkout-address-draft.ts"

function draft(partial: Partial<ShippingAddressFormInput> = {}): ShippingAddressFormInput {
  return {
    line1: "123 State St",
    line2: "",
    city: "Santa Barbara",
    state: "CA",
    postal_code: "93101",
    country: "US",
    ...partial,
  }
}

describe("checkout address draft", () => {
  it("treats a complete US address as ready to save", () => {
    assert.equal(isCheckoutAddressDraftReadyToSave(draft()), true)
    assert.equal(isCheckoutAddressDraftReadyToSave(draft({ postal_code: "93101-1234" })), true)
  })

  it("waits for a full ZIP before saving", () => {
    assert.equal(isCheckoutAddressDraftReadyToSave(draft({ postal_code: "931" })), false)
    assert.equal(isCheckoutAddressDraftReadyToSave(draft({ postal_code: "" })), false)
    assert.equal(isCheckoutAddressDraftReadyToSave(draft({ line1: "  " })), false)
    assert.equal(isCheckoutAddressDraftReadyToSave(draft({ state: "C" })), false)
    assert.equal(isCheckoutAddressDraftReadyToSave(draft({ country: "CA" })), false)
  })

  it("fingerprint ignores casing and blank line 2 differences", () => {
    const a = checkoutAddressDraftFingerprint(draft({ line1: "123 State St", line2: "" }))
    const b = checkoutAddressDraftFingerprint(draft({ line1: "123 state st", line2: "  " }))
    assert.equal(a, b)
    const withUnit = checkoutAddressDraftFingerprint(draft({ line2: "Apt 2" }))
    assert.notEqual(a, withUnit)
  })
})
