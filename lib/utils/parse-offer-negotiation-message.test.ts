import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  parseOfferNegotiationMessage,
  resolveNegotiationOffer,
} from "./parse-offer-negotiation-message.ts"

const LISTING_ID = "22222222-2222-4222-8222-222222222222"

describe("resolveNegotiationOffer", () => {
  it("matches a seller offer line to the offer with that amount", () => {
    const matched = resolveNegotiationOffer(
      [
        {
          id: "offer-a",
          status: "COUNTERED",
          current_amount: 18,
          listing_id: LISTING_ID,
          seller_initiated: true,
        },
        {
          id: "offer-b",
          status: "COUNTERED",
          current_amount: 15,
          listing_id: LISTING_ID,
          seller_initiated: true,
        },
      ],
      "Offer from seller: $15.00",
      LISTING_ID,
    )
    assert.equal(matched?.id, "offer-b")
    assert.equal(parseOfferNegotiationMessage("Offer from seller: $15.00"), "seller_offer")
  })

  it("returns null when several offers share the listing and the amount is missing", () => {
    const matched = resolveNegotiationOffer(
      [
        { id: "offer-a", status: "DECLINED", current_amount: 18, listing_id: LISTING_ID },
        { id: "offer-b", status: "DECLINED", current_amount: 15, listing_id: LISTING_ID },
      ],
      "Offer declined",
      LISTING_ID,
    )
    assert.equal(matched, null)
  })
})
