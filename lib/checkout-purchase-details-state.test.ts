import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { ShippingAddressFormInput } from "./address-input.ts"
import { checkoutAddressDraftFingerprint } from "./checkout-address-draft.ts"
import { resolveCheckoutPurchaseDetailsState } from "./checkout-purchase-details-state.ts"

const draft: ShippingAddressFormInput = {
  line1: "123 State St",
  line2: "",
  city: "Santa Barbara",
  state: "CA",
  postal_code: "93101",
  country: "US",
}

describe("checkout purchase details state", () => {
  it("reports an autosaved address while the form is still open", () => {
    const state = resolveCheckoutPurchaseDetailsState({
      needsShipping: true,
      showNewForm: true,
      phoneReady: true,
      pickupNameOk: true,
      selectedAddress: null,
      draft,
      savedDraft: {
        id: "addr_1",
        fingerprint: checkoutAddressDraftFingerprint(draft),
        version: 2,
      },
      addressVersion: 2,
    })
    assert.equal(state.readyToPay, true)
    assert.equal(state.shippingAddressId, "addr_1")
    assert.equal(state.shippingState, "CA")
    assert.equal(state.shippingAddressVersion, 2)
  })

  it("does not quote a stale address while the buyer is still editing", () => {
    const state = resolveCheckoutPurchaseDetailsState({
      needsShipping: true,
      showNewForm: true,
      phoneReady: true,
      pickupNameOk: true,
      selectedAddress: { id: "addr_1", state: "CA", city: "Santa Barbara" },
      draft: { ...draft, postal_code: "93108" },
      savedDraft: {
        id: "addr_1",
        fingerprint: checkoutAddressDraftFingerprint(draft),
        version: 2,
      },
      addressVersion: 2,
    })
    assert.equal(state.readyToPay, false)
    assert.equal(state.shippingAddressId, null)
  })

  it("keeps a chosen saved address ready without the new-address form", () => {
    const state = resolveCheckoutPurchaseDetailsState({
      needsShipping: true,
      showNewForm: false,
      phoneReady: true,
      pickupNameOk: true,
      selectedAddress: { id: "addr_9", state: "CA", city: "Goleta" },
      draft,
      savedDraft: null,
      addressVersion: 0,
    })
    assert.equal(state.shippingAddressId, "addr_9")
    assert.equal(state.shippingCity, "Goleta")
    assert.equal(state.readyToPay, true)
  })
})
