import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { ReswellListingRateRow } from "../services/reswellListingShippingRate.ts"
import {
  filterReswellRatesForPeerSection,
  findPeerCheckoutRateOptionByServiceCode,
  isNonContiguousUsShipTo,
  peerCheckoutShippingServiceError,
  surfboardCheckoutBucket,
  toPeerCheckoutShippingRateOptions,
  upsSurfboardCheckoutBucket,
} from "./peer-checkout-usps-services.ts"

const HI = { stateProvince: "HI", postalCode: "96813" }
const AK = { stateProvince: "Alaska", postalCode: "99501" }
const CA = { stateProvince: "CA", postalCode: "93101" }

function rate(
  partial: Partial<ReswellListingRateRow> &
    Pick<ReswellListingRateRow, "rate_id" | "carrierName" | "serviceCode" | "serviceName">,
): ReswellListingRateRow {
  return {
    totalAmount: 100,
    currency: "USD",
    carrierCode: null,
    deliveryDays: 3,
    estimatedDeliveryDate: null,
    attributes: [],
    ...partial,
  }
}

const UPS_GROUND = rate({
  rate_id: "ups-ground",
  carrierCode: "ups",
  carrierName: "UPS",
  serviceCode: "ups_ground",
  serviceName: "UPS Ground",
  totalAmount: 80,
})
const UPS_3_DAY = rate({
  rate_id: "ups-3day",
  carrierCode: "ups",
  carrierName: "UPS",
  serviceCode: "ups_3_day_select",
  serviceName: "UPS 3 Day Select",
  totalAmount: 110,
})
const UPS_2ND = rate({
  rate_id: "ups-2nd",
  carrierCode: "ups",
  carrierName: "UPS",
  serviceCode: "ups_2nd_day_air",
  serviceName: "UPS 2nd Day Air",
  totalAmount: 160,
})
const UPS_NEXT = rate({
  rate_id: "ups-next",
  carrierCode: "ups",
  carrierName: "UPS",
  serviceCode: "ups_next_day_air",
  serviceName: "UPS Next Day Air",
  totalAmount: 240,
})
const FEDEX_2DAY = rate({
  rate_id: "fx-2day",
  carrierCode: "fedex",
  carrierName: "FedEx",
  serviceCode: "fedex_2day",
  serviceName: "FedEx 2Day",
  totalAmount: 175,
})
const FEDEX_OVERNIGHT = rate({
  rate_id: "fx-ovn",
  carrierCode: "fedex",
  carrierName: "FedEx",
  serviceCode: "fedex_priority_overnight",
  serviceName: "FedEx Priority Overnight",
  totalAmount: 310,
})
const FEDEX_GROUND = rate({
  rate_id: "fx-gnd",
  carrierCode: "fedex",
  carrierName: "FedEx",
  serviceCode: "fedex_ground",
  serviceName: "FedEx Ground",
  totalAmount: 90,
})
const UPS_FREIGHT = rate({
  rate_id: "ups-frt",
  carrierCode: "ups",
  carrierName: "UPS Freight",
  serviceCode: "ups_freight",
  serviceName: "UPS Freight",
  totalAmount: 400,
})

const ALL_RATES = [
  UPS_GROUND,
  UPS_3_DAY,
  UPS_2ND,
  UPS_NEXT,
  FEDEX_2DAY,
  FEDEX_OVERNIGHT,
  FEDEX_GROUND,
  UPS_FREIGHT,
]

describe("isNonContiguousUsShipTo", () => {
  it("detects Hawaii and Alaska by state or ZIP", () => {
    assert.equal(isNonContiguousUsShipTo(HI), true)
    assert.equal(isNonContiguousUsShipTo(AK), true)
    assert.equal(isNonContiguousUsShipTo({ postalCode: "96734" }), true)
    assert.equal(isNonContiguousUsShipTo({ postalCode: "99501" }), true)
    assert.equal(isNonContiguousUsShipTo(CA), false)
    assert.equal(isNonContiguousUsShipTo(null), false)
  })
})

describe("surfboardCheckoutBucket", () => {
  it("keeps continental UPS Ground / 3 Day / 2nd Day and drops air and FedEx", () => {
    assert.equal(surfboardCheckoutBucket("ups_ground", "UPS Ground", "ups", CA), "ups_ground")
    assert.equal(surfboardCheckoutBucket("ups_3_day_select", "UPS 3 Day Select", "ups", CA), "ups_3_day")
    assert.equal(surfboardCheckoutBucket("ups_2nd_day_air", "UPS 2nd Day Air", "ups", CA), "ups_2nd_day")
    assert.equal(surfboardCheckoutBucket("ups_next_day_air", "UPS Next Day Air", "ups", CA), null)
    assert.equal(surfboardCheckoutBucket("fedex_2day", "FedEx 2Day", "fedex", CA), null)
    assert.equal(upsSurfboardCheckoutBucket("ups_ground", "UPS Ground"), "ground")
  })

  it("keeps UPS and FedEx air services that serve Hawaii", () => {
    assert.equal(surfboardCheckoutBucket("ups_2nd_day_air", "UPS 2nd Day Air", "ups", HI), "ups_2nd_day")
    assert.equal(surfboardCheckoutBucket("ups_next_day_air", "UPS Next Day Air", "ups", HI), "ups_next_day")
    assert.equal(surfboardCheckoutBucket("ups_next_day_air_saver", "UPS Next Day Air Saver", "ups", HI), "ups_next_day")
    assert.equal(surfboardCheckoutBucket("fedex_2day", "FedEx 2Day", "fedex", HI), "fedex_2day")
    assert.equal(surfboardCheckoutBucket("fedex_express_saver", "FedEx Express Saver", "fedex", HI), "fedex_2day")
    assert.equal(
      surfboardCheckoutBucket("fedex_priority_overnight", "FedEx Priority Overnight", "fedex", HI),
      "fedex_overnight",
    )
    assert.equal(surfboardCheckoutBucket("ups_ground", "UPS Ground", "ups", HI), null)
    assert.equal(surfboardCheckoutBucket("fedex_ground", "FedEx Ground", "fedex", HI), null)
  })
})

describe("filterReswellRatesForPeerSection", () => {
  it("keeps continental UPS parcel options only", () => {
    const kept = filterReswellRatesForPeerSection(ALL_RATES, "surfboards", CA).map((row) => row.rate_id)
    assert.deepEqual(kept, ["ups-ground", "ups-3day", "ups-2nd"])
  })

  it("keeps Hawaii-capable UPS and FedEx air rates", () => {
    const kept = filterReswellRatesForPeerSection(ALL_RATES, "surfboards", HI).map((row) => row.rate_id)
    assert.deepEqual(kept, ["ups-2nd", "ups-next", "fx-2day", "fx-ovn"])
  })
})

describe("toPeerCheckoutShippingRateOptions", () => {
  it("labels Hawaii UPS and FedEx air options for the picker", () => {
    const options = toPeerCheckoutShippingRateOptions(ALL_RATES, "surfboards", HI)
    assert.deepEqual(
      options.map((option) => option.displayName),
      ["UPS Second Day Air", "FedEx 2Day", "UPS Next Day Air", "FedEx Overnight"],
    )
  })

  it("still defaults continental checkout to UPS Ground first", () => {
    const options = toPeerCheckoutShippingRateOptions(ALL_RATES, "surfboards", CA)
    assert.equal(options[0]?.displayName, "UPS Ground")
    assert.equal(options.some((option) => option.displayName.includes("FedEx")), false)
  })
})

describe("findPeerCheckoutRateOptionByServiceCode", () => {
  it("resolves a Hawaii Next Day selection onto the Next Day bucket", () => {
    const options = toPeerCheckoutShippingRateOptions(ALL_RATES, "surfboards", HI)
    const found = findPeerCheckoutRateOptionByServiceCode(
      options,
      "ups_next_day_air_saver",
      "surfboards",
      HI,
    )
    assert.equal(found?.displayName, "UPS Next Day Air")
  })
})

describe("peerCheckoutShippingServiceError", () => {
  it("names UPS and FedEx air when Hawaii has no rates", () => {
    assert.match(peerCheckoutShippingServiceError("surfboards", HI), /UPS and FedEx air/)
    assert.match(peerCheckoutShippingServiceError("surfboards", CA), /UPS Ground/)
  })
})
