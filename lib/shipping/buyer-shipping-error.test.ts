import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buyerFacingCheckoutShippingError,
  mapCarrierTextToPublicReason,
  publicFacingShippingFailure,
  sellerFacingLabelRateError,
} from "./buyer-shipping-error.ts"

describe("mapCarrierTextToPublicReason", () => {
  it("maps address, parcel, PO Box, and funds failures", () => {
    assert.match(
      mapCarrierTextToPublicReason("Recipient address is not valid for this service.") ?? "",
      /street, city, and ZIP/,
    )
    assert.match(mapCarrierTextToPublicReason("Weight exceeds maximum for this service.") ?? "", /size or weight/)
    assert.match(mapCarrierTextToPublicReason("Destination is a PO Box") ?? "", /PO Box/)
    assert.match(mapCarrierTextToPublicReason("insufficient funds on account") ?? "", /temporarily unavailable/)
  })

  it("does not pass raw carrier text through", () => {
    assert.equal(mapCarrierTextToPublicReason("carrier_unavailable: stamps_com"), null)
  })
})

describe("buyerFacingCheckoutShippingError", () => {
  it("uses the carrier invalid_rates reason instead of the generic family copy", () => {
    const message = buyerFacingCheckoutShippingError({
      section: "fins",
      shipTo: { stateProvince: "VA", postalCode: "23451", line1: "408 Terrace Ave" },
      rateFamily: "usps_ground_priority",
      invalidRates: [
        {
          serviceCode: "usps_ground_advantage",
          serviceName: "USPS Ground Advantage",
          message: "Recipient address is not valid for this service.",
        },
      ],
    })
    assert.match(message, /street, city, and ZIP/)
    assert.doesNotMatch(message, /Recipient address/)
  })

  it("keeps the PO Box family copy when the carrier is silent", () => {
    const message = buyerFacingCheckoutShippingError({
      section: "fins",
      shipTo: { stateProvince: "CA", postalCode: "93101", line1: "PO Box 123" },
      rateFamily: "usps_ground_priority",
    })
    assert.match(message, /PO Box/)
  })
})

describe("publicFacingShippingFailure", () => {
  it("replaces JSON dumps with the fallback", () => {
    const message = publicFacingShippingFailure({
      apiError: '{"errors":[{"error_code":"carrier_unavailable","message":"nope"}]}',
      fallback: "Could not get shipping rates for this address. Try again or contact support.",
    })
    assert.equal(message, "Could not get shipping rates for this address. Try again or contact support.")
  })

  it("keeps an already-human error", () => {
    const message = sellerFacingLabelRateError({
      apiError: "Save a ship-from address on your profile first.",
    })
    assert.match(message, /ship-from address/)
  })
})
