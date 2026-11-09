import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  canOperateOrderAsSeller,
  marketplaceOrderParticipantRole,
  sellerIdsForOrderWork,
} from "./order-operator.ts"

const ACTOR = "actor-user"
const SHOP = "shop-account"

describe("order operator", () => {
  it("includes the shop when the active role can write orders", () => {
    assert.deepEqual(
      sellerIdsForOrderWork({
        actorUserId: ACTOR,
        operatingAccountId: SHOP,
        canWriteOrders: true,
      }),
      [ACTOR, SHOP],
    )
  })

  it("keeps personal sales when the active role cannot write shop orders", () => {
    assert.deepEqual(
      sellerIdsForOrderWork({
        actorUserId: ACTOR,
        operatingAccountId: SHOP,
        canWriteOrders: false,
      }),
      [ACTOR],
    )
  })

  it("lets staff operate the shop sale they are working in", () => {
    assert.equal(
      canOperateOrderAsSeller({
        orderSellerId: SHOP,
        actorUserId: ACTOR,
        operatingSellerId: SHOP,
        canWriteOrders: true,
      }),
      true,
    )
  })

  it("does not let a shop role operate a different seller", () => {
    assert.equal(
      canOperateOrderAsSeller({
        orderSellerId: "someone-else",
        actorUserId: ACTOR,
        operatingSellerId: SHOP,
        canWriteOrders: true,
      }),
      false,
    )
  })

  it("treats the signed-in person as the buyer of their own purchase", () => {
    assert.equal(
      marketplaceOrderParticipantRole({
        buyerId: ACTOR,
        sellerId: SHOP,
        actorUserId: ACTOR,
        operatingSellerId: SHOP,
        canWriteOrders: true,
      }),
      "buyer",
    )
  })

  it("treats a shop order as a seller action while working in that shop", () => {
    assert.equal(
      marketplaceOrderParticipantRole({
        buyerId: "buyer",
        sellerId: SHOP,
        actorUserId: ACTOR,
        operatingSellerId: SHOP,
        canWriteOrders: true,
      }),
      "seller",
    )
  })
})
