import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { adminOrderStaffCapabilities } from "./admin-order-capabilities.ts"

const peerShipped = {
  isReswellShop: false,
  status: "confirmed",
  fulfillmentMethod: "shipping",
  deliveryStatus: "in_transit",
  hasBuyer: true,
} as const

describe("adminOrderStaffCapabilities", () => {
  it("lets a marketplace admin issue returns and refunds", () => {
    const caps = adminOrderStaffCapabilities({ isAdmin: true, ...peerShipped })
    assert.equal(caps.canRefund, true)
    assert.equal(caps.canReleaseShippingSellerEarnings, true)
    assert.equal(caps.canReplaceShippingLabel, true)
    assert.equal(caps.canFulfillReswellShop, false)
  })

  it("does not treat a missing isAdmin flag as admin (employee copy regression)", () => {
    const caps = adminOrderStaffCapabilities({ isAdmin: undefined, ...peerShipped })
    assert.equal(caps.canRefund, false)
    assert.equal(caps.canReleaseShippingSellerEarnings, false)
    assert.equal(caps.canReplaceShippingLabel, false)
    assert.equal(caps.canFulfillReswellShop, false)
  })

  it("does not grant refunds to employees", () => {
    const caps = adminOrderStaffCapabilities({ isAdmin: false, ...peerShipped })
    assert.equal(caps.canRefund, false)
  })
})
