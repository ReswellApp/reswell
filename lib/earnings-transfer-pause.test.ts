import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { EARNINGS_TRANSFER_PAUSE } from "./earnings-transfer-pause.ts"

const sellerCopy = [
  EARNINGS_TRANSFER_PAUSE.bannerTitle,
  EARNINGS_TRANSFER_PAUSE.bannerBody,
  EARNINGS_TRANSFER_PAUSE.toastTitle,
  EARNINGS_TRANSFER_PAUSE.toastDetail,
].join(" ")

describe("earnings transfer pause copy", () => {
  it("tells sellers transfers are paused while we fix them", () => {
    assert.match(EARNINGS_TRANSFER_PAUSE.bannerBody, /working on fixing this/i)
    assert.match(EARNINGS_TRANSFER_PAUSE.bannerBody, /hang tight/i)
    assert.match(EARNINGS_TRANSFER_PAUSE.toastTitle, /hang tight/i)
    assert.match(EARNINGS_TRANSFER_PAUSE.toastDetail, /balance is safe/i)
    assert.equal(EARNINGS_TRANSFER_PAUSE.errorCode, "platform_balance_insufficient")
  })

  it("does not surface Stripe’s insufficient-funds wording", () => {
    assert.doesNotMatch(sellerCopy, /insufficient funds|not enough funds|stripe account/i)
  })
})
