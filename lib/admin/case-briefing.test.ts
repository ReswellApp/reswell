import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildCaseBriefing,
  collectCustomerCaseTexts,
  mentionsAlreadyMailed,
  mentionsIncorrectItem,
  mentionsLabelFromAddress,
} from "./case-briefing.ts"
import type { CaseInboxItem } from "./case-inbox.ts"

function item(overrides: Partial<CaseInboxItem> = {}): CaseInboxItem {
  return {
    key: "sc:1",
    backend: "order_support",
    id: "case-1",
    subject: "[Seller] Order help - NQUKM8",
    preview: "The mail from address on this shipping label is incorrect.",
    fromName: "Seller",
    fromEmail: "seller@example.com",
    userId: "user-1",
    kind: "order_question",
    kindLabel: "Order question",
    status: "submitted",
    statusLabel: "Submitted",
    channelLabel: "Order",
    orderId: "order-1",
    orderRef: "NQUKM8",
    createdAt: "2026-09-08T00:00:00.000Z",
    updatedAt: "2026-09-08T00:00:00.000Z",
    isOpen: true,
    isNew: true,
    assigneeAdminId: null,
    slaState: "on_track",
    slaLabel: "Due 1 hour",
    priority: "high",
    contact: null,
    order: {
      id: "os-1",
      order_id: "order-1",
      buyer_id: "buyer-1",
      request_type: "help",
      body: "The mail from address on this shipping label is incorrect.",
      contacted_seller_first: null,
      order_ref: "NQUKM8",
      created_at: "2026-09-08T00:00:00.000Z",
      support_status: "new",
      requester_role: "seller",
      assignee_admin_id: null,
      internal_notes: null,
      outcome: null,
      updated_at: "2026-09-08T00:00:00.000Z",
      support_conversation_id: null,
      carrier_claim_status: null,
      carrier_claim_id: null,
      carrier_claim_url: null,
      insurance_claim_url: null,
      repair_credit_total: 0,
      repair_credit_last_at: null,
    },
    ...overrides,
  }
}

describe("case briefing", () => {
  it("detects a wrong label FROM-address complaint", () => {
    assert.equal(
      mentionsLabelFromAddress("The mail from address on this shipping label is incorrect."),
      true,
    )
    assert.equal(mentionsAlreadyMailed("I am mailing the package as is."), true)
    assert.equal(mentionsIncorrectItem("I received the wrong item and need to return it."), true)
    assert.equal(mentionsIncorrectItem("The mail from address is incorrect."), false)
  })

  it("keeps the original request and later customer replies", () => {
    const texts = collectCustomerCaseTexts(item(), [
      { author_role: "customer", is_internal: false, body: "I am mailing the package as is." },
      { author_role: "agent", is_internal: false, body: "Looking into this." },
    ])
    assert.deepEqual(texts, [
      "The mail from address on this shipping label is incorrect.",
      "I am mailing the package as is.",
    ])
  })

  it("explains a seller label-from case that already shipped", () => {
    const briefing = buildCaseBriefing({
      item: item(),
      messages: [
        {
          author_role: "customer",
          is_internal: false,
          body: "I am mailing the package as is.",
        },
      ],
      order: {
        id: "order-1",
        order_num: "NQUKM8",
        status: "confirmed",
        amount: 76.12,
        item_price: 65,
        shipping_amount: 11.12,
        platform_fee: 0,
        seller_earnings: 0,
        promo_discount_usd: 0,
        payment_method: "stripe",
        fulfillment_method: "shipping",
        created_at: "2026-09-07T00:00:00.000Z",
        refunded_at: null,
        buyer_id: "buyer-1",
        seller_id: "seller-1",
        listing_id: "listing-1",
        listing_title: "Futures Fins",
        listing_section: "used",
        listing_city: "Santa Barbara",
        listing_state: "CA",
        is_reswell_shop: false,
        buyer: {
          id: "buyer-1",
          email: null,
          display_name: "Buyer",
          avatar_url: null,
          city: null,
          state: null,
          bio: null,
          created_at: null,
          sales_count: null,
          shop_name: null,
          is_shop: null,
          shop_verified: null,
          seller_slug: null,
          shop_phone: null,
          shop_address: null,
        },
        seller: {
          id: "seller-1",
          email: "seller@example.com",
          display_name: "Seller",
          avatar_url: null,
          city: "Ventura",
          state: "CA",
          bio: null,
          created_at: null,
          sales_count: 4,
          shop_name: null,
          is_shop: false,
          shop_verified: null,
          seller_slug: null,
          shop_phone: null,
          shop_address: null,
        },
        shipping_address: null,
        order_items: [],
        stripe_checkout_session_id: null,
        delivery_status: "shipped",
        tracking_number: "9205510579500000263481",
        tracking_carrier: "usps_priority_mail",
        carrier_delivered_at: null,
        conversation_id: null,
        marketplace_message_count: 0,
        payout: { status: "held", hold_reason: "awaiting_delivery", released_at: null },
        sales_channel: "online",
        pickup_code: null,
      },
      extras: {
        hasShippingLabel: true,
        hasPaperlessQr: false,
        paperlessInstructions: null,
        paperlessHandoffCode: null,
        shipFromOnFile: {
          name: "David Barberio",
          oneLine: "12 Oak St · Ventura, CA 93001",
        },
      },
    })

    assert.match(briefing.summary, /seller/i)
    assert.match(briefing.summary, /NQUKM8/)
    assert.match(briefing.ask ?? "", /mail from address/i)
    assert.match(briefing.latestUpdate ?? "", /as is/i)
    assert.ok(briefing.facts.some((fact) => fact.includes("shipped")))
    assert.ok(briefing.facts.some((fact) => fact.includes("held")))
    assert.ok(briefing.hints.some((hint) => hint.includes("listing city/state")))
    assert.ok(briefing.hints.some((hint) => hint.includes("already mailed")))
  })

  it("points agents to item returns plus the item-amount refund", () => {
    const briefing = buildCaseBriefing({
      item: item({
        preview: "I received the wrong item and need to return it.",
        order: {
          ...item().order!,
          body: "I received the wrong item and need to return it.",
        },
      }),
      messages: [],
      order: null,
      extras: null,
    })

    assert.ok(briefing.hints.some((hint) => hint.includes("Issue refund — item amount")))
    assert.ok(briefing.hints.some((hint) => hint.includes("Item returns")))
  })
})
