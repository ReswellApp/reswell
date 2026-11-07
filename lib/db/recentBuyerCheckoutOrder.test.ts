import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  checkoutListingIdsMatch,
  dbFindRecentDuplicateBuyerCheckoutOrder,
} from "@/lib/db/recentBuyerCheckoutOrder"

describe("checkoutListingIdsMatch", () => {
  it("matches the same listing set regardless of order", () => {
    assert.equal(checkoutListingIdsMatch(["a", "b"], ["b", "a"]), true)
    assert.equal(checkoutListingIdsMatch(["a"], ["a", "b"]), false)
    assert.equal(checkoutListingIdsMatch(["a"], ["c"]), false)
  })
})

describe("dbFindRecentDuplicateBuyerCheckoutOrder", () => {
  it("returns the newest order whose items match the checkout listings", async () => {
    const api = {
      from(table: string) {
        if (table === "orders") {
          return {
            select() {
              return {
                eq() {
                  return {
                    in() {
                      return {
                        gte() {
                          return {
                            order() {
                              return {
                                limit() {
                                  return Promise.resolve({
                                    data: [
                                      {
                                        id: "newer-other",
                                        listing_id: "listing-b",
                                        created_at: "2026-11-07T16:00:00.000Z",
                                      },
                                      {
                                        id: "match",
                                        listing_id: "listing-a",
                                        created_at: "2026-11-07T15:43:00.000Z",
                                      },
                                    ],
                                    error: null,
                                  })
                                },
                              }
                            },
                          }
                        },
                      }
                    },
                  }
                },
              }
            },
          }
        }
        return {
          select() {
            return {
              in() {
                return Promise.resolve({
                  data: [
                    { order_id: "newer-other", listing_id: "listing-b" },
                    { order_id: "match", listing_id: "listing-a" },
                  ],
                  error: null,
                })
              },
            }
          },
        }
      },
    }

    const found = await dbFindRecentDuplicateBuyerCheckoutOrder(api as never, {
      buyerId: "buyer-1",
      listingIds: ["listing-a"],
    })
    assert.deepEqual(found, {
      orderId: "match",
      createdAt: "2026-11-07T15:43:00.000Z",
    })
  })
})
