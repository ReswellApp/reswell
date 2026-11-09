import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  decideSignInShipFromPrompt,
  isCompleteSellerShipFrom,
  signInShipFromDismissStorageKey,
  type SignInShipFromAddress,
} from "./signInShipFromPrompt.ts"

function address(overrides: Partial<SignInShipFromAddress> = {}): SignInShipFromAddress {
  return {
    id: "addr-1",
    full_name: "Pacific Vibrations",
    phone: "8055550100",
    line1: "1891 East Main St",
    line2: null,
    city: "Ventura",
    state: "CA",
    postal_code: "93001",
    country: "US",
    is_default: true,
    ...overrides,
  }
}

describe("isCompleteSellerShipFrom", () => {
  it("requires a street, city, state, and ZIP", () => {
    assert.equal(isCompleteSellerShipFrom(address()), true)
    assert.equal(isCompleteSellerShipFrom(address({ line1: "  " })), false)
    assert.equal(isCompleteSellerShipFrom(address({ postal_code: "" })), false)
    assert.equal(isCompleteSellerShipFrom(address({ state: "California" })), true)
  })
})

describe("decideSignInShipFromPrompt", () => {
  it("does not prompt buyers who do not ship", () => {
    const result = decideSignInShipFromPrompt({
      offersShipping: false,
      addresses: [],
      personal: null,
      listingCity: "Ventura",
      listingState: "ca",
    })
    assert.deepEqual(result, { shouldPrompt: false })
  })

  it("does not prompt when the preferred address is already a complete ship-from", () => {
    const result = decideSignInShipFromPrompt({
      offersShipping: true,
      addresses: [address()],
      personal: { first_name: "Ada", last_name: "Lovelace", phone: "8055550100" },
      listingCity: "Ventura",
      listingState: "CA",
    })
    assert.equal(result.shouldPrompt, false)
  })

  it("prefills listing city and state and leaves the street blank", () => {
    const result = decideSignInShipFromPrompt({
      offersShipping: true,
      addresses: [],
      personal: { first_name: "Ada", last_name: "Lovelace", phone: "8055550100" },
      listingCity: "Ventura ",
      listingState: "ca",
    })
    assert.equal(result.shouldPrompt, true)
    if (!result.shouldPrompt) return
    assert.equal(result.prefill.line1, "")
    assert.equal(result.prefill.line2, "")
    assert.equal(result.prefill.city, "Ventura")
    assert.equal(result.prefill.state, "CA")
    assert.equal(result.prefill.postal_code, "")
    assert.equal(result.addressId, null)
    assert.equal(result.fromSavedAddress, false)
    assert.equal(result.needsFullName, false)
    assert.equal(result.needsPhone, false)
    assert.match(result.detail ?? "", /Ventura, CA/)
    assert.doesNotMatch(JSON.stringify(result.prefill), /100 Main/i)
  })

  it("fills the form from a saved address and updates that row", () => {
    const result = decideSignInShipFromPrompt({
      offersShipping: true,
      addresses: [
        address({
          id: "addr-partial",
          line1: "915 De La Vina St",
          line2: "Suite 2",
          postal_code: "",
          is_default: true,
        }),
      ],
      personal: { first_name: null, last_name: null, phone: null },
      listingCity: "Santa Barbara",
      listingState: "CA",
    })
    assert.equal(result.shouldPrompt, true)
    if (!result.shouldPrompt) return
    assert.equal(result.addressId, "addr-partial")
    assert.equal(result.fromSavedAddress, true)
    assert.equal(result.prefill.line1, "915 De La Vina St")
    assert.equal(result.prefill.line2, "Suite 2")
    assert.equal(result.prefill.city, "Ventura")
    assert.equal(result.prefill.full_name, "Pacific Vibrations")
    assert.equal(result.prefill.phone, "8055550100")
    assert.equal(result.needsFullName, true)
    assert.equal(result.needsPhone, true)
    assert.equal(result.detail, null)
  })

  it("uses a complete saved address when the default row is only a city", () => {
    const result = decideSignInShipFromPrompt({
      offersShipping: true,
      addresses: [
        address({
          id: "addr-empty",
          line1: "",
          city: "Ventura",
          postal_code: "",
          is_default: true,
        }),
        address({
          id: "addr-real",
          line1: "1891 East Main St",
          postal_code: "93001",
          is_default: false,
        }),
      ],
      personal: { first_name: "Ada", last_name: "Lovelace", phone: "8055550100" },
      listingCity: null,
      listingState: null,
    })
    assert.equal(result.shouldPrompt, true)
    if (!result.shouldPrompt) return
    assert.equal(result.addressId, "addr-real")
    assert.equal(result.prefill.line1, "1891 East Main St")
    assert.equal(result.prefill.postal_code, "93001")
  })
})

describe("signInShipFromDismissStorageKey", () => {
  it("changes when the user signs in again", () => {
    const first = signInShipFromDismissStorageKey("user-1", "2026-10-13T15:00:00Z")
    const next = signInShipFromDismissStorageKey("user-1", "2026-10-13T18:00:00Z")
    assert.notEqual(first, next)
    assert.match(first, /^reswell-ship-from-prompt-dismissed:user-1:/)
  })
})
