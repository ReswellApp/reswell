import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LIVE_CHAT_SELLER_PAYOUT_HELP_SLUGS,
  isLiveChatSellerPayoutHowtoIntent,
  liveChatPinnedHelpSlugs,
} from "./howto-intent.ts"

describe("live chat seller payout how-to intent", () => {
  it("treats Hayden's sold-board money ask as a how-to, not an order lookup", () => {
    assert.equal(
      isLiveChatSellerPayoutHowtoIntent("hi there. i sold a board. how do i get my money?"),
      true,
    )
    assert.equal(isLiveChatSellerPayoutHowtoIntent("How do I get paid after a sale?"), true)
    assert.equal(isLiveChatSellerPayoutHowtoIntent("how do I get paid?"), true)
    assert.equal(isLiveChatSellerPayoutHowtoIntent("how do cash outs work"), true)
  })

  it("leaves this-sale payout status as a lookup", () => {
    assert.equal(isLiveChatSellerPayoutHowtoIntent("Where is my payout for order 1042?"), false)
    assert.equal(isLiveChatSellerPayoutHowtoIntent("My sale is still pending — is it stuck?"), false)
    assert.equal(isLiveChatSellerPayoutHowtoIntent("hi there"), false)
  })

  it("does not treat buyer payment or refund phrasing as a seller cash-out", () => {
    assert.equal(isLiveChatSellerPayoutHowtoIntent("how do I pay for this board?"), false)
    assert.equal(isLiveChatSellerPayoutHowtoIntent("I paid for this board"), false)
    assert.equal(isLiveChatSellerPayoutHowtoIntent("when do I get my money back?"), false)
    assert.equal(isLiveChatSellerPayoutHowtoIntent("can I get a refund?"), false)
    assert.equal(isLiveChatSellerPayoutHowtoIntent("I want my money back"), false)
    assert.ok(liveChatPinnedHelpSlugs("I want a refund").includes("purchase-protection-claim"))
    assert.ok(liveChatPinnedHelpSlugs("I paid for this board").includes("purchase-protection-claim"))
  })

  it("pins payout help for that how-to instead of protection defaults", () => {
    const slugs = liveChatPinnedHelpSlugs("i sold a board. how do i get my money?")
    assert.deepEqual(slugs, [...LIVE_CHAT_SELLER_PAYOUT_HELP_SLUGS])
    assert.ok(liveChatPinnedHelpSlugs("the board never arrived").includes("purchase-protection-claim"))
  })
})
