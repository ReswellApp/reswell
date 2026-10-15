import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isGoogleMerchantEligibleListing,
  isShippableSurfboardGoogleMerchantListing,
  mapListingToProductInput,
  type GoogleMerchantListingRow,
} from "./map-listing-to-product-input.ts"
import { googleMerchantProductInputsToTsv } from "./product-feed-tsv.ts"

function listing(overrides: Partial<GoogleMerchantListingRow>): GoogleMerchantListingRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "ci-twin",
    title: "CI Twin",
    description: "Used shortboard",
    price: 450,
    condition: "very_good",
    brand: "Channel Islands Surfboards",
    section: "surfboards",
    status: "active",
    hidden_from_site: false,
    archived_at: null,
    shipping_available: true,
    listing_images: [{ url: "https://cdn.example.com/board.jpg", is_primary: true }],
    ...overrides,
  }
}

describe("shippable surfboard merchant eligibility", () => {
  it("keeps shippable surfboards and drops pickup-only boards", () => {
    const ships = listing({})
    const pickup = listing({ shipping_available: false })
    assert.equal(isGoogleMerchantEligibleListing(ships), true)
    assert.equal(isShippableSurfboardGoogleMerchantListing(ships), true)
    assert.equal(isGoogleMerchantEligibleListing(pickup), false)
    assert.equal(mapListingToProductInput(pickup), null)
  })

  it("still accepts other sections that do not ship", () => {
    const fins = listing({
      section: "fins",
      shipping_available: false,
      title: "Medium fins",
    })
    assert.equal(isGoogleMerchantEligibleListing(fins), true)
    assert.equal(isShippableSurfboardGoogleMerchantListing(fins), false)
  })

  it("writes a TSV row with shipping and the shippable feed label", () => {
    const product = mapListingToProductInput(listing({}), undefined, {
      feedLabel: "SHIP",
      customLabel2: "Shipping",
    })
    assert.ok(product)
    assert.equal(product.feedLabel, "SHIP")
    const tsv = googleMerchantProductInputsToTsv([product])
    const [header, row] = tsv.trim().split("\n")
    assert.match(header ?? "", /^id\ttitle\t/)
    assert.match(row ?? "", /in_stock/)
    assert.match(row ?? "", /450\.00 USD/)
    assert.match(row ?? "", /Shipping/)
    assert.match(row ?? "", /US::/)
  })
})
