import type { ShippingAddressFormInput } from "@/lib/address-input"
import { checkoutAddressDraftFingerprint } from "@/lib/checkout-address-draft"

export type CheckoutPurchaseDetailsState = {
  readyToPay: boolean
  /** Required for Stripe when shipping; null for pickup-only checkout. */
  shippingAddressId: string | null
  /** Selected saved-address state, when one is chosen. */
  shippingState?: string | null
  shippingCity?: string | null
  /**
   * Increments when the saved address row changes so a quote refetches
   * even if the address id stays the same.
   */
  shippingAddressVersion: number
}

export function resolveCheckoutPurchaseDetailsState(input: {
  needsShipping: boolean
  showNewForm: boolean
  phoneReady: boolean
  pickupNameOk: boolean
  selectedAddress: { id: string; state: string | null; city: string | null } | null
  draft: ShippingAddressFormInput
  /** Address row saved from the open form. Null until autosave or Save succeeds. */
  savedDraft: { id: string; fingerprint: string; version: number } | null
  addressVersion: number
}): CheckoutPurchaseDetailsState {
  if (!input.needsShipping) {
    return {
      readyToPay: input.pickupNameOk && input.phoneReady,
      shippingAddressId: null,
      shippingState: null,
      shippingCity: null,
      shippingAddressVersion: input.addressVersion,
    }
  }

  if (input.showNewForm) {
    const fingerprint = checkoutAddressDraftFingerprint(input.draft)
    const saved = input.savedDraft
    if (saved && saved.fingerprint === fingerprint) {
      return {
        readyToPay: input.phoneReady,
        shippingAddressId: saved.id,
        shippingState: input.draft.state?.trim() || null,
        shippingCity: input.draft.city.trim() || null,
        shippingAddressVersion: saved.version,
      }
    }
    return {
      readyToPay: false,
      shippingAddressId: null,
      shippingState: null,
      shippingCity: null,
      shippingAddressVersion: input.addressVersion,
    }
  }

  if (input.selectedAddress) {
    return {
      readyToPay: input.phoneReady,
      shippingAddressId: input.selectedAddress.id,
      shippingState: input.selectedAddress.state,
      shippingCity: input.selectedAddress.city,
      shippingAddressVersion: input.addressVersion,
    }
  }

  return {
    readyToPay: false,
    shippingAddressId: null,
    shippingState: null,
    shippingCity: null,
    shippingAddressVersion: input.addressVersion,
  }
}
