import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { ShipEnginePurchasedLabel } from "../shipengine/purchased-label.ts"
import { chargeUsdForPurchasedLabel, purchasedLabelFromApi } from "../shipengine/purchased-label.ts"
import {
  buildLabelSpendTotals,
  defaultLabelSpendDateRange,
  kindForPurchasedLabel,
  resolveLabelSpendDateRange,
  roundMoney,
} from "./label-spend-math.ts"

function label(partial: Partial<ShipEnginePurchasedLabel> & { labelId: string }): ShipEnginePurchasedLabel {
  return {
    shipmentId: null,
    trackingNumber: null,
    carrierCode: "ups",
    serviceCode: "ups_ground",
    createdAt: "2026-09-02T18:00:00.000Z",
    voided: false,
    isReturnLabel: false,
    postageUsd: 0,
    insuranceUsd: 0,
    ...partial,
  }
}

describe("resolveLabelSpendDateRange", () => {
  it("defaults to the current Pacific calendar month", () => {
    const resolved = resolveLabelSpendDateRange({ nowMs: Date.parse("2026-09-08T19:00:00.000Z") })
    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.equal(resolved.range.dateFrom, "2026-09-01")
    assert.equal(resolved.range.dateTo, "2026-09-08")
    assert.equal(resolved.range.startIso, "2026-09-01T07:00:00.000Z")
  })

  it("rejects an inverted range", () => {
    const resolved = resolveLabelSpendDateRange({ dateFrom: "2026-09-08", dateTo: "2026-09-01" })
    assert.equal(resolved.ok, false)
  })

  it("uses defaultLabelSpendDateRange for the current month start", () => {
    const range = defaultLabelSpendDateRange(Date.parse("2026-09-08T19:00:00.000Z"))
    assert.deepEqual(range, { dateFrom: "2026-09-01", dateTo: "2026-09-08" })
  })
})

describe("purchasedLabelFromApi + chargeUsdForPurchasedLabel", () => {
  it("reads postage and insurance from ShipEngine money objects", () => {
    const parsed = purchasedLabelFromApi({
      label_id: "se-123",
      tracking_number: "1Z999",
      carrier_code: "ups",
      created_at: "2026-09-02T18:00:00.000Z",
      shipment_cost: { amount: 12.45, currency: "usd" },
      insurance_cost: { amount: 1.5, currency: "usd" },
      voided: false,
      is_return_label: false,
    })
    assert.ok(parsed)
    assert.equal(parsed?.postageUsd, 12.45)
    assert.equal(parsed?.insuranceUsd, 1.5)
    assert.equal(chargeUsdForPurchasedLabel(parsed!), 13.95)
  })

  it("charges voided labels at zero", () => {
    const parsed = purchasedLabelFromApi({
      label_id: "se-void",
      voided: true,
      shipment_cost: { amount: 18.2, currency: "usd" },
    })
    assert.ok(parsed)
    assert.equal(kindForPurchasedLabel(parsed!), "voided")
    assert.equal(chargeUsdForPurchasedLabel(parsed!), 0)
  })
})

describe("buildLabelSpendTotals", () => {
  it("sums postage, insurance, and adjustments into the Stripe transfer amount", () => {
    const totals = buildLabelSpendTotals({
      labels: [
        label({ labelId: "a", postageUsd: 10.1, insuranceUsd: 0.4 }),
        label({ labelId: "b", postageUsd: 8, insuranceUsd: 0, isReturnLabel: true }),
        label({ labelId: "c", postageUsd: 20, voided: true }),
      ],
      adjustmentsUsd: 2.25,
      buyerShippingCollectedUsd: 40,
      matchedOrders: 2,
    })

    assert.equal(totals.labelsPurchased, 2)
    assert.equal(totals.labelsVoided, 1)
    assert.equal(totals.labelsReturn, 1)
    assert.equal(totals.postageUsd, 18.1)
    assert.equal(totals.insuranceUsd, 0.4)
    assert.equal(totals.adjustmentsUsd, 2.25)
    assert.equal(totals.transferUsd, 20.75)
    assert.equal(totals.buyerShippingCollectedUsd, 40)
    assert.equal(roundMoney(10.105), 10.11)
  })
})
