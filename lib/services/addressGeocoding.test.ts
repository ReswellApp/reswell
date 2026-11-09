import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  addressFieldsFromVerifiedGoogleStreet,
  verifiedGoogleStreetFromStoredAddress,
} from "./addressGeocoding.ts"

const resolved = {
  formattedAddress: "123 Main St, Santa Barbara, CA 93101, USA",
  placeId: "google-place-1",
  latitude: 34.4208,
  longitude: -119.6982,
  line1: "123 Main St",
  line2: "",
  city: "Santa Barbara",
  state: "CA",
  postalCode: "93101",
  country: "US",
}

describe("addressFieldsFromVerifiedGoogleStreet", () => {
  it("stores canonical fields with server verification provenance", () => {
    const fields = addressFieldsFromVerifiedGoogleStreet(
      resolved,
      "2026-10-07T17:00:00.000Z",
    )

    assert.deepEqual(fields, {
      line1: "123 Main St",
      line2: null,
      city: "Santa Barbara",
      state: "CA",
      postal_code: "93101",
      country: "US",
      google_place_id: "google-place-1",
      latitude: 34.4208,
      longitude: -119.6982,
      formatted_address: "123 Main St, Santa Barbara, CA 93101, USA",
      google_geocoded_at: "2026-10-07T17:00:00.000Z",
    })
  })
})

describe("verifiedGoogleStreetFromStoredAddress", () => {
  const address = {
    line1: "123 Main St",
    line2: null,
    city: "Santa Barbara",
    state: "CA",
    postal_code: "93101",
    country: "US",
    google_place_id: "google-place-1",
    latitude: 34.4208,
    longitude: -119.6982,
    formatted_address: "123 Main St, Santa Barbara, CA 93101, USA",
    google_geocoded_at: "2026-10-07T17:00:00.000Z",
  }

  it("reuses a complete server-verified location", () => {
    assert.deepEqual(verifiedGoogleStreetFromStoredAddress(address), resolved)
  })

  it("does not trust legacy client coordinates without provenance", () => {
    assert.equal(
      verifiedGoogleStreetFromStoredAddress({
        ...address,
        google_geocoded_at: null,
      }),
      null,
    )
  })
})
