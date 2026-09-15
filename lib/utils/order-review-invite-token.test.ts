import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  decodeOrderReviewInviteToken,
  orderPurchasePath,
  orderPurchaseReviewPath,
} from "./order-review-invite-token.ts"

describe("order purchase review paths", () => {
  it("points the email CTA at the purchase page", () => {
    const orderId = "11111111-1111-1111-1111-111111111111"
    assert.equal(orderPurchasePath(orderId), `/dashboard/purchases/${orderId}`)
    assert.equal(
      orderPurchaseReviewPath(orderId),
      `/dashboard/purchases/${orderId}?review=1`,
    )
  })

  it("decodes a URL-encoded invite token", () => {
    assert.equal(decodeOrderReviewInviteToken(" abc%2Fdef "), "abc/def")
    assert.equal(decodeOrderReviewInviteToken("plain_token"), "plain_token")
  })
})
