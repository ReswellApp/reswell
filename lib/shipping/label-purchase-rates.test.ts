import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LABEL_PURCHASE_RATE_LIMIT,
  curateLabelPurchaseRates,
  type LabelPurchaseRate,
} from "./label-purchase-rates.ts"

function rate(
  partial: Partial<LabelPurchaseRate> &
    Pick<LabelPurchaseRate, "rate_id" | "carrierLabel" | "serviceName" | "amount">,
): LabelPurchaseRate {
  return {
    currency: "USD",
    carrierCode: null,
    serviceCode: null,
    ...partial,
  }
}

describe("curateLabelPurchaseRates", () => {
  it("keeps only the cheapest Ground/Priority per carrier and caps at the standard limit", () => {
    const curated = curateLabelPurchaseRates([
      rate({
        rate_id: "ups-ground",
        carrierLabel: "UPS",
        carrierCode: "ups",
        serviceName: "UPS Ground",
        serviceCode: "ups_ground",
        amount: 15.81,
      }),
      rate({
        rate_id: "ups-ground-expensive",
        carrierLabel: "UPS",
        carrierCode: "ups",
        serviceName: "UPS Ground",
        serviceCode: "ups_ground",
        amount: 22,
      }),
      rate({
        rate_id: "ups-2day",
        carrierLabel: "UPS",
        carrierCode: "ups",
        serviceName: "UPS 2nd Day Air",
        serviceCode: "ups_2nd_day_air",
        amount: 40,
      }),
      rate({
        rate_id: "ups-overnight",
        carrierLabel: "UPS",
        carrierCode: "ups",
        serviceName: "UPS Next Day Air",
        serviceCode: "ups_next_day_air",
        amount: 90,
      }),
    ])

    assert.equal(curated.length, 1)
    assert.equal(curated[0]?.rate_id, "ups-ground")
    assert.ok(curated.length <= LABEL_PURCHASE_RATE_LIMIT)
  })

  it("includeAllDistinctServices returns Ground, air, and overnight UPS options", () => {
    const curated = curateLabelPurchaseRates(
      [
        rate({
          rate_id: "ups-ground",
          carrierLabel: "UPS",
          carrierCode: "ups",
          serviceName: "UPS Ground",
          serviceCode: "ups_ground",
          amount: 15.81,
        }),
        rate({
          rate_id: "ups-3day",
          carrierLabel: "UPS",
          carrierCode: "ups",
          serviceName: "UPS 3 Day Select",
          serviceCode: "ups_3_day_select",
          amount: 28,
        }),
        rate({
          rate_id: "ups-2day",
          carrierLabel: "UPS",
          carrierCode: "ups",
          serviceName: "UPS 2nd Day Air",
          serviceCode: "ups_2nd_day_air",
          amount: 40,
        }),
        rate({
          rate_id: "ups-overnight",
          carrierLabel: "UPS",
          carrierCode: "ups",
          serviceName: "UPS Next Day Air",
          serviceCode: "ups_next_day_air",
          amount: 90,
        }),
        rate({
          rate_id: "ups-ground-dupe",
          carrierLabel: "UPS",
          carrierCode: "ups",
          serviceName: "UPS Ground",
          serviceCode: "ups_ground",
          amount: 18,
        }),
      ],
      null,
      { includeAllDistinctServices: true },
    )

    assert.deepEqual(
      curated.map((row) => row.rate_id),
      ["ups-ground", "ups-3day", "ups-2day", "ups-overnight"],
    )
  })

  it("includeSameAndNextDay keeps overnight when standard mode is otherwise Ground/Priority only", () => {
    const curated = curateLabelPurchaseRates(
      [
        rate({
          rate_id: "ups-ground",
          carrierLabel: "UPS",
          carrierCode: "ups",
          serviceName: "UPS Ground",
          serviceCode: "ups_ground",
          amount: 15,
        }),
        rate({
          rate_id: "ups-overnight",
          carrierLabel: "UPS",
          carrierCode: "ups",
          serviceName: "UPS Next Day Air",
          serviceCode: "ups_next_day_air",
          amount: 90,
        }),
        rate({
          rate_id: "ups-2day",
          carrierLabel: "UPS",
          carrierCode: "ups",
          serviceName: "UPS 2nd Day Air",
          serviceCode: "ups_2nd_day_air",
          amount: 40,
        }),
      ],
      null,
      { includeSameAndNextDay: true },
    )

    assert.deepEqual(
      curated.map((row) => row.rate_id),
      ["ups-ground", "ups-overnight"],
    )
  })
})
