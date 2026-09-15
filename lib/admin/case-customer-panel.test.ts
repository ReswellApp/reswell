import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildCustomerPanelFlags,
  emptyCustomerCommerce,
  merchandiseAmount,
  thisOrderSnapshotFromAdminOrder,
  toSupportCaseCustomerOrder,
  toSupportCaseCustomerTicket,
} from "./case-customer-panel.ts"

describe("case customer panel helpers", () => {
  it("treats shipping as excluded merchandise", () => {
    assert.equal(merchandiseAmount(120, 20), 100)
    assert.equal(merchandiseAmount(10, 40), 0)
  })

  it("maps buyer vs seller role from the participant id", () => {
    const buyer = toSupportCaseCustomerOrder(
      {
        id: "o1",
        order_num: "RS-100",
        seller_id: "seller",
        buyer_id: "buyer",
        amount: 80,
        shipping_amount: 10,
        status: "confirmed",
        created_at: "2026-01-01T00:00:00.000Z",
        listing_id: "l1",
        listing_title: "Mid-length",
      },
      "buyer",
    )
    assert.equal(buyer.role, "buyer")
    assert.equal(buyer.merchandiseAmount, 70)

    const sale = toSupportCaseCustomerOrder(
      {
        id: "o2",
        order_num: "RS-101",
        seller_id: "buyer",
        buyer_id: "other",
        amount: 80,
        shipping_amount: 10,
        status: "confirmed",
        created_at: "2026-01-02T00:00:00.000Z",
        listing_id: "l2",
        listing_title: "Gun",
      },
      "buyer",
    )
    assert.equal(sale.role, "seller")
  })

  it("maps a lean ticket row", () => {
    const ticket = toSupportCaseCustomerTicket({
      id: "c1",
      subject: "Where is my board?",
      status: "waiting_on_you",
      kind: "order_question",
      order_ref: "RS-100",
      priority: "high",
      updated_at: "2026-02-01T00:00:00.000Z",
      created_at: "2026-01-15T00:00:00.000Z",
    })
    assert.equal(ticket.orderRef, "RS-100")
    assert.equal(ticket.priority, "high")
  })

  it("builds Intercom-style flags without inventing account state", () => {
    assert.deepEqual(
      buildCustomerPanelFlags({
        hasProfile: false,
        matchedByEmail: false,
        isShop: false,
        verified: false,
        sellerBanned: false,
        isStaff: false,
        openTicketCount: 0,
      }),
      [{ id: "guest", label: "Guest / no account", tone: "outline" }],
    )

    const flags = buildCustomerPanelFlags({
      hasProfile: true,
      matchedByEmail: true,
      isShop: true,
      verified: true,
      sellerBanned: true,
      isStaff: true,
      openTicketCount: 3,
    })
    assert.deepEqual(
      flags.map((flag) => flag.id),
      ["email_match", "staff", "verified", "seller_banned", "open_tickets"],
    )
    assert.equal(flags.find((flag) => flag.id === "open_tickets")?.label, "3 open tickets")
  })

  it("snapshots pay and ship fields the rail actually shows", () => {
    const snapshot = thisOrderSnapshotFromAdminOrder({
      id: "o1",
      order_num: "RS-9",
      status: "confirmed",
      amount: 250,
      item_price: 230,
      shipping_amount: 20,
      payment_method: "card",
      fulfillment_method: "shipping",
      delivery_status: "in_transit",
      tracking_number: "1Z999",
      tracking_carrier: "UPS",
      carrier_delivered_at: null,
      listing_title: "Fish",
      refunded_at: null,
      pickup_code: null,
      payout: { status: "held", hold_reason: "delivery_hold" },
    })
    assert.equal(snapshot.trackingNumber, "1Z999")
    assert.equal(snapshot.payoutStatus, "held")
    assert.equal(emptyCustomerCommerce().purchases, 0)
  })
})
