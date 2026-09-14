import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LISTING_BUYER_OPEN_OFFER_STATUSES,
  conversationRowsToOfferKeyMap,
  offerConversationKey,
  offerMessagesHref,
} from "./offer-messages-href.ts"

describe("offerMessagesHref", () => {
  const offer = {
    listing_id: "listing-1",
    buyer_id: "buyer-1",
    seller_id: "seller-1",
  }

  it("opens the conversation when the thread id is known", () => {
    assert.equal(
      offerMessagesHref(offer, "buyer", "conv-9"),
      "/messages/conv-9",
    )
  })

  it("anchors to the offer card when the offer id is known", () => {
    assert.equal(
      offerMessagesHref({ ...offer, id: "abc-123" }, "buyer", "conv-9"),
      "/messages/conv-9#offer-abc-123",
    )
  })

  it("falls back to a listing-scoped compose URL for the other party", () => {
    assert.equal(
      offerMessagesHref(offer, "buyer", null),
      "/messages/new?user=seller-1&listing=listing-1",
    )
    assert.equal(
      offerMessagesHref(offer, "seller"),
      "/messages/new?user=buyer-1&listing=listing-1",
    )
  })

  it("includes the offer id on the compose fallback so the thread can land on it", () => {
    assert.equal(
      offerMessagesHref({ ...offer, id: "abc-123" }, "seller", null),
      "/messages/new?user=buyer-1&listing=listing-1&offer=abc-123",
    )
  })
})

describe("conversationRowsToOfferKeyMap", () => {
  it("indexes listing threads by buyer and seller", () => {
    assert.deepEqual(
      conversationRowsToOfferKeyMap([
        {
          id: "conv-1",
          listing_id: "l1",
          buyer_id: "b1",
          seller_id: "s1",
        },
        {
          id: "conv-skip",
          listing_id: null,
          buyer_id: "b1",
          seller_id: "s1",
        },
      ]),
      { "l1:b1:s1": "conv-1" },
    )
  })
})

describe("offerConversationKey", () => {
  it("is stable for a listing-scoped buyer/seller pair", () => {
    assert.equal(
      offerConversationKey("l1", "b1", "s1"),
      "l1:b1:s1",
    )
  })
})

describe("LISTING_BUYER_OPEN_OFFER_STATUSES", () => {
  it("treats pending and countered offers as open on the listing page", () => {
    assert.deepEqual([...LISTING_BUYER_OPEN_OFFER_STATUSES], ["PENDING", "COUNTERED"])
  })
})
