import assert from "node:assert/strict"
import { describe, it } from "node:test"
// @ts-expect-error Node's type-stripping test runner requires the TypeScript extension.
import {
  CARRIER_DELIVERY_PAYOUT_HOLD_DAYS,
  carrierDeliveryPayoutEligibleAt,
  carrierDeliveryPayoutHoldElapsed,
} from "./carrier-delivery-payout-timing.ts"

describe("carrier delivery payout hold", () => {
  const deliveredAt = new Date("2026-10-01T12:00:00.000Z")

  it("makes shipped earnings eligible four days after delivery", () => {
    assert.equal(CARRIER_DELIVERY_PAYOUT_HOLD_DAYS, 4)
    assert.equal(
      carrierDeliveryPayoutEligibleAt(deliveredAt).toISOString(),
      "2026-10-05T12:00:00.000Z",
    )
  })

  it("does not release before the four-day hold elapses", () => {
    assert.equal(
      carrierDeliveryPayoutHoldElapsed(deliveredAt, new Date("2026-10-05T11:59:59.999Z")),
      false,
    )
    assert.equal(
      carrierDeliveryPayoutHoldElapsed(deliveredAt, new Date("2026-10-05T12:00:00.000Z")),
      true,
    )
  })
})
