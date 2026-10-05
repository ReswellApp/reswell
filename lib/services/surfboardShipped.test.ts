import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { CoastalMatchShipper } from "./coastalDeliveryMatch.ts"
import {
  SURFBOARD_SHIPPED_FEE_CENTS,
  SURFBOARD_SHIPPED_FEE_USD,
  attachSurfboardShippedShipper,
  isCaliforniaAddressState,
  isGoogleCaliforniaStreet,
  readSurfboardShippedPaymentMetadata,
  surfboardShippedCheckoutVisible,
  surfboardShippedSellVisible,
  surfboardShippedWindow,
} from "./surfboardShipped.ts"

function shipper(
  id: string,
  name: string,
  dayOfWeek: number,
  enabled = true,
  scheduleEnabled = true,
): CoastalMatchShipper {
  return {
    shipperId: id,
    displayName: name,
    scheduleEnabled,
    runs: [
      {
        id: `${id}-run`,
        dayOfWeek,
        direction: "northbound",
        enabled,
        stopIds: ["santa-cruz", "san-francisco"],
      },
    ],
  }
}

const now = new Date("2026-06-15T18:00:00.000Z")

describe("surfboard shipped gates", () => {
  const live = [shipper("a", "Avery", 2)]

  it("recognizes California", () => {
    assert.equal(isCaliforniaAddressState("CA"), true)
    assert.equal(isCaliforniaAddressState("California"), true)
    assert.equal(isCaliforniaAddressState("NV"), false)
    assert.equal(isCaliforniaAddressState(""), false)
  })

  it("shows the sell option only for an admin with a California pickup and a live shipper", () => {
    assert.equal(
      surfboardShippedSellVisible({ isAdmin: true, pickupState: "CA", shippers: live }),
      true,
    )
    assert.equal(
      surfboardShippedSellVisible({ isAdmin: false, pickupState: "CA", shippers: live }),
      false,
    )
    assert.equal(
      surfboardShippedSellVisible({ isAdmin: true, pickupState: "Oregon", shippers: live }),
      false,
    )
    assert.equal(
      surfboardShippedSellVisible({
        isAdmin: true,
        pickupState: "CA",
        shippers: [shipper("a", "Avery", 2, false, false)],
      }),
      false,
    )
    assert.equal(
      surfboardShippedSellVisible({
        isAdmin: true,
        pickupState: "CA",
        shippers: [shipper("a", "Avery", 2, false, true)],
      }),
      false,
    )
  })

  it("hides checkout unless the buyer is an admin, Google placed both streets in California, and a shipper is live", () => {
    const base = {
      isAdmin: true,
      sellerOptedIn: true,
      pickupInCalifornia: true,
      buyerInCalifornia: true,
      shippers: live,
    }
    assert.equal(surfboardShippedCheckoutVisible(base), true)
    assert.equal(surfboardShippedCheckoutVisible({ ...base, isAdmin: false }), false)
    assert.equal(surfboardShippedCheckoutVisible({ ...base, buyerInCalifornia: false }), false)
    assert.equal(surfboardShippedCheckoutVisible({ ...base, pickupInCalifornia: false }), false)
    assert.equal(surfboardShippedCheckoutVisible({ ...base, sellerOptedIn: false }), false)
    assert.equal(surfboardShippedCheckoutVisible({ ...base, shippers: [] }), false)
  })

  it("accepts any Google-resolved California street, including Los Angeles and Oakland", () => {
    assert.equal(
      isGoogleCaliforniaStreet({ country: "US", state: "CA", line1: "123 Abbot Kinney Blvd" }),
      true,
    )
    assert.equal(
      isGoogleCaliforniaStreet({ country: "US", state: "California", line1: "1 Broadway" }),
      true,
    )
    assert.equal(isGoogleCaliforniaStreet({ country: "US", state: "NV", line1: "10 Fremont St" }), false)
    assert.equal(isGoogleCaliforniaStreet({ country: "US", state: "CA", line1: "Market St" }), false)
    assert.equal(isGoogleCaliforniaStreet(null), false)
  })
})

describe("surfboard shipped match and window", () => {
  it("charges a flat $100", () => {
    assert.equal(SURFBOARD_SHIPPED_FEE_USD, 100)
    assert.equal(SURFBOARD_SHIPPED_FEE_CENTS, 10_000)
  })

  it("uses a 7–14 day Pacific window", () => {
    const window = surfboardShippedWindow(now)
    assert.equal(window.label, "7–14 days")
    assert.equal(window.startDate, "2026-06-22")
    assert.equal(window.endDate, "2026-06-29")
  })

  it("attaches the soonest live run for any California trip, including the same city", () => {
    const attached = attachSurfboardShippedShipper({
      shippers: [shipper("later", "Blair", 5), shipper("sooner", "Avery", 1)],
      now,
    })
    assert.ok(attached)
    assert.equal(attached?.shipperId, "sooner")
    assert.equal(attached?.displayName, "Avery")
    assert.equal(attached?.availableShippers.length, 2)
    assert.equal(attached?.availableShippers.every((row) => row.live), true)
  })

  it("records $100 owed from payment metadata and rejects a partial snapshot", () => {
    const shipperId = "b7c1a001-0001-4000-8000-000000000011"
    const runId = "b7c1a001-0001-4000-8000-000000000022"
    const read = readSurfboardShippedPaymentMetadata({
      surfboard_shipped: "1",
      surfboard_shipped_cents: "10000",
      surfboard_shipped_shipper_id: shipperId,
      surfboard_shipped_run_id: runId,
      surfboard_shipped_window_start: "2026-06-22",
      surfboard_shipped_window_end: "2026-06-29",
    })
    assert.equal(read?.ok, true)
    if (read?.ok) {
      assert.equal(read.feeUsd, 100)
      assert.equal(read.write.surfboard_shipped_owed_cents, 10000)
      assert.equal(read.write.surfboard_shipped_shipper_id, shipperId)
    }
    assert.equal(readSurfboardShippedPaymentMetadata({ surfboard_shipped: "1" })?.ok, false)
    assert.equal(readSurfboardShippedPaymentMetadata(null), null)
  })

  it("does not attach when no run is live", () => {
    assert.equal(
      attachSurfboardShippedShipper({
        shippers: [shipper("a", "Avery", 2, true, false)],
        now,
      }),
      null,
    )
    assert.equal(
      attachSurfboardShippedShipper({
        shippers: [shipper("a", "Avery", 2, false, true)],
        now,
      }),
      null,
    )
  })
})
