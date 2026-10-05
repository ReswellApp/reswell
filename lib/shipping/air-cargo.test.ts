import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { parseAirCargoAirport } from "../validations/air-cargo-airport.ts"
import {
  AIR_CARGO_RATE_ID,
  AIR_CARGO_SERVICE_CODE,
  AIR_CARGO_UNPRICED_ERROR,
  airCargoPackageRates,
  airCargoPieceCount,
  applyAirCargoToOrderShippingJson,
  composeAirCargoCheckoutQuote,
  isAirCargoServiceCode,
  readOrderAirCargo,
} from "./air-cargo.ts"

const GROUND = {
  rateId: "ups-ground",
  serviceCode: "ups_ground",
  serviceName: "UPS Ground",
  displayName: "UPS Ground",
  totalAmount: 88,
  deliveryDays: 5,
  estimatedDeliveryDate: null,
}

describe("air cargo pricing", () => {
  it("counts pieces without turning that count into a price", () => {
    assert.equal(airCargoPieceCount({ packagingMode: "together", listingCount: 3 }), 1)
    assert.equal(airCargoPieceCount({ packagingMode: "separate", listingCount: 3 }), 3)
    const split = airCargoPackageRates(["a", "b", "c"], 100)
    assert.deepEqual(
      split.map((rate) => rate.shippingCents),
      [3334, 3333, 3333],
    )
  })

  it("does not invent an air cargo price when the lane has not been quoted", () => {
    const composed = composeAirCargoCheckoutQuote({
      offersAirCargo: true,
      airCargoQuoteUsd: null,
      requestedServiceCode: "ups_ground",
      pieceCount: 1,
      listingIds: ["board-1"],
      packagingMode: "together",
      carrier: {
        ok: true,
        shippingUsd: 88,
        usedReswellQuote: true,
        selectedRate: { rateId: GROUND.rateId, serviceCode: GROUND.serviceCode, serviceName: GROUND.serviceName },
        availableRates: [GROUND],
      },
    })
    assert.equal(composed.ok, true)
    if (!composed.ok) return
    assert.equal(composed.shippingUsd, 88)
    assert.equal(composed.availableRates?.some((rate) => isAirCargoServiceCode(rate.serviceCode)), false)
  })

  it("refuses to charge air cargo when no lane quote exists", () => {
    const composed = composeAirCargoCheckoutQuote({
      offersAirCargo: true,
      requestedServiceCode: AIR_CARGO_SERVICE_CODE,
      pieceCount: 1,
      listingIds: ["board-1"],
      packagingMode: "together",
      carrier: { ok: false, error: "No carrier rates returned for this shipment." },
    })
    assert.equal(composed.ok, false)
    if (composed.ok) return
    assert.equal(composed.error, AIR_CARGO_UNPRICED_ERROR)
  })

  it("charges the quoted lane total, not a flat fee per board", () => {
    const composed = composeAirCargoCheckoutQuote({
      offersAirCargo: true,
      airCargoQuoteUsd: 248.4,
      requestedServiceCode: AIR_CARGO_SERVICE_CODE,
      pieceCount: 2,
      listingIds: ["board-1", "board-2"],
      packagingMode: "separate",
      carrier: {
        ok: true,
        shippingUsd: 210,
        usedReswellQuote: true,
        selectedRate: { rateId: GROUND.rateId, serviceCode: GROUND.serviceCode, serviceName: GROUND.serviceName },
        availableRates: [GROUND],
        packageRates: [
          { listingId: "board-1", rateId: "ups-1", shippingCents: 10000, serviceCode: "ups_ground" },
          { listingId: "board-2", rateId: "ups-2", shippingCents: 11000, serviceCode: "ups_ground" },
        ],
      },
    })
    assert.equal(composed.ok, true)
    if (!composed.ok) return
    assert.equal(composed.shippingUsd, 248.4)
    assert.equal(composed.selectedRate?.rateId, AIR_CARGO_RATE_ID)
    assert.equal(composed.groundShippingUsd, 210)
    assert.equal(composed.packageRates?.[0]?.shippingCents, 12420)
    assert.equal(composed.packageRates?.[1]?.shippingCents, 12420)
    assert.equal(composed.packageRates?.[1]?.serviceCode, AIR_CARGO_SERVICE_CODE)
  })

  it("can stand alone when ground fails and this lane has a cargo quote", () => {
    const composed = composeAirCargoCheckoutQuote({
      offersAirCargo: true,
      airCargoQuoteUsd: 310,
      requestedServiceCode: null,
      pieceCount: 1,
      listingIds: ["board-1"],
      packagingMode: "together",
      carrier: { ok: false, error: "No carrier rates returned for this shipment." },
    })
    assert.equal(composed.ok, true)
    if (!composed.ok) return
    assert.equal(composed.shippingUsd, 310)
    assert.equal(composed.selectedRate?.serviceCode, AIR_CARGO_SERVICE_CODE)
    assert.match(composed.groundUnavailableReason ?? "", /No carrier rates/)
  })

  it("leaves non-surfboard quotes unchanged", () => {
    const composed = composeAirCargoCheckoutQuote({
      offersAirCargo: false,
      requestedServiceCode: AIR_CARGO_SERVICE_CODE,
      pieceCount: 1,
      listingIds: ["fin-1"],
      packagingMode: "together",
      carrier: { ok: false, error: "USPS Ground is not available." },
    })
    assert.equal(composed.ok, false)
  })
})

describe("air cargo airport", () => {
  it("uppercases a 3-letter code and keeps a full airport name", () => {
    const code = parseAirCargoAirport(" lax ")
    assert.equal(code.ok, true)
    if (code.ok) assert.equal(code.airport, "LAX")

    const name = parseAirCargoAirport("  Los Angeles   International ")
    assert.equal(name.ok, true)
    if (name.ok) assert.equal(name.airport, "Los Angeles International")
  })

  it("rejects blanks and junk", () => {
    assert.equal(parseAirCargoAirport("").ok, false)
    assert.equal(parseAirCargoAirport("LA").ok, false)
    assert.equal(parseAirCargoAirport("!!!").ok, false)
  })

  it("round-trips the airport onto the order shipping json", () => {
    const stored = applyAirCargoToOrderShippingJson({ name: "Avery" }, "HNL")
    const read = readOrderAirCargo(stored)
    assert.equal(read?.airport, "HNL")
    assert.equal(read?.pickupWithinHours, 48)
    assert.equal(readOrderAirCargo({ name: "Avery" }), null)
  })
})
