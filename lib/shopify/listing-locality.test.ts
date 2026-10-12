import assert from "node:assert/strict"
import test from "node:test"
import { resolveShopifyListingLocality } from "@/lib/shopify/listing-locality"

test("uses the seller's saved default listing locality", () => {
  assert.deepEqual(
    resolveShopifyListingLocality({
      default_listing_city: " San Clemente ",
      default_listing_state: "CA",
      location: "Somewhere else",
    }),
    { city: "San Clemente", state: "CA" },
  )
})

test("falls back to profile city, then location, then a national placeholder", () => {
  assert.deepEqual(
    resolveShopifyListingLocality({
      default_listing_city: "  ",
      city: "Encinitas",
      location: "Oceanside, CA",
    }),
    { city: "Encinitas", state: "US" },
  )
  assert.deepEqual(
    resolveShopifyListingLocality({
      default_listing_city: "  ",
      default_listing_state: null,
      location: "Oceanside, CA",
    }),
    { city: "Oceanside, CA", state: "US" },
  )
  assert.deepEqual(resolveShopifyListingLocality(null), {
    city: "United States",
    state: "US",
  })
})
