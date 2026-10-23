import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  listingFieldsForPeerUpdate,
  resolveListingUpdateActor,
} from "./listing-update-actor.ts"

describe("resolveListingUpdateActor", () => {
  it("uses the owner path when a seller edits their own listing", () => {
    assert.equal(
      resolveListingUpdateActor({
        actorIsAdmin: false,
        actorUserId: "seller-1",
        listingOwnerId: "seller-1",
      }),
      "owner",
    )
  })

  it("uses the owner path when an admin edits their own listing", () => {
    assert.equal(
      resolveListingUpdateActor({
        actorIsAdmin: true,
        actorUserId: "admin-1",
        listingOwnerId: "admin-1",
      }),
      "owner",
    )
  })

  it("uses the admin path only when an admin edits someone else's listing", () => {
    assert.equal(
      resolveListingUpdateActor({
        actorIsAdmin: true,
        actorUserId: "admin-1",
        listingOwnerId: "seller-1",
      }),
      "admin",
    )
  })

  it("forbids a non-admin from editing someone else's listing", () => {
    assert.equal(
      resolveListingUpdateActor({
        actorIsAdmin: false,
        actorUserId: "seller-1",
        listingOwnerId: "seller-2",
      }),
      "forbidden",
    )
  })

  it("lets a shop member edit the shop listing without becoming an admin", () => {
    assert.equal(
      resolveListingUpdateActor({
        actorIsAdmin: false,
        actorUserId: "employee",
        listingOwnerId: "admin-shop",
        memberCanWriteShop: true,
      }),
      "member",
    )
  })

  it("does not treat shop membership as admin when the member cannot write that shop", () => {
    assert.equal(
      resolveListingUpdateActor({
        actorIsAdmin: false,
        actorUserId: "employee",
        listingOwnerId: "admin-shop",
        memberCanWriteShop: false,
      }),
      "forbidden",
    )
  })

  it("forbids saves while the listing owner is still unknown", () => {
    assert.equal(
      resolveListingUpdateActor({
        actorIsAdmin: true,
        actorUserId: "admin-1",
        listingOwnerId: null,
      }),
      "forbidden",
    )
  })
})

describe("listingFieldsForPeerUpdate", () => {
  it("strips identity and visibility columns for both owner and admin writes", () => {
    const next = listingFieldsForPeerUpdate({
      title: "Twin fin",
      user_id: "attacker",
      status: "sold",
      slug: "hijack",
      hidden_from_site: true,
      site_visibility_reason: "nope",
      search_tags: ["fish"],
      local_pickup: true,
    })
    assert.equal(next.title, "Twin fin")
    assert.equal(next.local_pickup, true)
    assert.equal("user_id" in next, false)
    assert.equal("status" in next, false)
    assert.equal("slug" in next, false)
    assert.equal("hidden_from_site" in next, false)
    assert.equal("search_tags" in next, false)
  })

  it("turns the sell form's price text into the numeric column", () => {
    const next = listingFieldsForPeerUpdate({
      title: "Twin fin",
      price: "49.95",
    })
    assert.equal(next.price, 49.95)
  })

  it("drops a price that is not an amount instead of leaving the text", () => {
    const next = listingFieldsForPeerUpdate({
      title: "Twin fin",
      price: "abc",
    })
    assert.equal("price" in next, false)
  })
})
