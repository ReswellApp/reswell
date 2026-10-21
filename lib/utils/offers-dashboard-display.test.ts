import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { DashboardOfferRow } from "@/lib/types/offers-dashboard"
import {
  dashboardOffersPath,
  offerAwaitsUser,
  offerStatusLabel,
  offersPageLoginRedirect,
  parseOfferFocusId,
  parseOffersTab,
} from "./offers-dashboard-display.ts"

const OFFER_ID = "11111111-1111-4111-8111-111111111111"

function row(overrides: Partial<DashboardOfferRow> = {}): DashboardOfferRow {
  return {
    id: OFFER_ID,
    status: "PENDING",
    current_amount: 900,
    initial_amount: 900,
    expires_at: "2099-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    counter_count: 0,
    listing_id: "listing-1",
    buyer_id: "buyer-1",
    seller_id: "seller-1",
    listings: {
      id: "listing-1",
      title: "Board",
      slug: "board",
      section: "surfboards",
      price: 1100,
      status: "active",
      listing_images: null,
    },
    ...overrides,
  }
}

describe("parseOffersTab", () => {
  it("keeps email links on the selling tab", () => {
    assert.equal(parseOffersTab("received"), "seller")
    assert.equal(parseOffersTab("seller"), "seller")
    assert.equal(parseOffersTab(undefined), "seller")
  })

  it("keeps buyer links on the buying tab", () => {
    assert.equal(parseOffersTab("buyer"), "buyer")
    assert.equal(parseOffersTab("made"), "buyer")
  })
})

describe("parseOfferFocusId", () => {
  it("accepts an offer uuid from the email query", () => {
    assert.equal(parseOfferFocusId(`  ${OFFER_ID}  `), OFFER_ID)
  })

  it("ignores tracking junk and empty values", () => {
    assert.equal(parseOfferFocusId(undefined), null)
    assert.equal(parseOfferFocusId(""), null)
    assert.equal(parseOfferFocusId("not-an-id"), null)
    assert.equal(parseOfferFocusId("cpSPkVMXg5b0wK2CxQ2SFxXlOnGd0VHYbA52zmA1AWA"), null)
  })
})

describe("dashboardOffersPath", () => {
  it("points a seller email at the received tab and that offer", () => {
    assert.equal(
      dashboardOffersPath({ role: "seller", offerId: OFFER_ID }),
      `/dashboard/offers?tab=received&offer=${OFFER_ID}`,
    )
  })

  it("points a buyer email at the buying tab and that offer", () => {
    assert.equal(
      dashboardOffersPath({ role: "buyer", offerId: OFFER_ID }),
      `/dashboard/offers?tab=buyer&offer=${OFFER_ID}`,
    )
  })
})

describe("offersPageLoginRedirect", () => {
  it("keeps the email query through sign-in", () => {
    assert.equal(
      offersPageLoginRedirect("/dashboard/offers", { tab: "received", offer: OFFER_ID }),
      `/auth/login?redirect=${encodeURIComponent(`/dashboard/offers?tab=received&offer=${OFFER_ID}`)}`,
    )
  })

  it("drops an offer id that is not a uuid", () => {
    assert.equal(
      offersPageLoginRedirect("/dashboard/offers", { tab: "received", offer: "nope" }),
      `/auth/login?redirect=${encodeURIComponent("/dashboard/offers?tab=received")}`,
    )
  })
})

describe("offerStatusLabel", () => {
  const now = Date.parse("2026-06-01T00:00:00.000Z")

  it("names the next step instead of the stored status", () => {
    assert.equal(offerStatusLabel(row(), "seller", now), "Needs you")
    assert.equal(offerStatusLabel(row(), "buyer", now), "Waiting on seller")
    assert.equal(
      offerStatusLabel(row({ status: "COUNTERED", seller_initiated: true }), "seller", now),
      "Offer sent",
    )
    assert.equal(
      offerStatusLabel(row({ status: "COUNTERED", seller_initiated: true }), "buyer", now),
      "Needs you",
    )
    assert.equal(
      offerStatusLabel(row({ status: "COUNTERED", seller_initiated: false }), "seller", now),
      "Waiting on buyer",
    )
    assert.equal(
      offerStatusLabel(row({ status: "ACCEPTED", payment_intent_id: null }), "buyer", now),
      "Ready to pay",
    )
    assert.equal(
      offerStatusLabel(row({ status: "ACCEPTED", payment_intent_id: "pi_123" }), "buyer", now),
      "Accepted",
    )
    assert.equal(
      offerStatusLabel(row({ status: "ACCEPTED", payment_intent_id: null }), "seller", now),
      "Waiting on payment",
    )
  })
})

describe("offerAwaitsUser", () => {
  const now = Date.parse("2026-06-01T00:00:00.000Z")

  it("asks the seller to respond to a pending bid", () => {
    assert.equal(offerAwaitsUser(row(), "seller", now), true)
    assert.equal(offerAwaitsUser(row(), "buyer", now), false)
  })

  it("asks the buyer to respond to a counter", () => {
    const countered = row({ status: "COUNTERED" })
    assert.equal(offerAwaitsUser(countered, "buyer", now), true)
    assert.equal(offerAwaitsUser(countered, "seller", now), false)
  })

  it("skips expired and sold negotiations", () => {
    assert.equal(
      offerAwaitsUser(row({ expires_at: "2020-01-01T00:00:00.000Z" }), "seller", now),
      false,
    )
    assert.equal(
      offerAwaitsUser(
        row({
          status: "ACCEPTED",
          listings: {
            id: "listing-1",
            title: "Board",
            slug: "board",
            section: "surfboards",
            price: 1100,
            status: "sold",
            listing_images: null,
          },
        }),
        "seller",
        now,
      ),
      false,
    )
  })
})
