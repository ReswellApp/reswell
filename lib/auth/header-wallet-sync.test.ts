import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveHeaderWalletBalance, walletTotalBalanceUsd } from "./header-wallet-sync.ts"

describe("resolveHeaderWalletBalance", () => {
  it("returns the reconciled total when a wallet row is present", () => {
    const total = resolveHeaderWalletBalance({
      data: {
        balance: "10.00",
        pending_balance: "2.50",
        lifetime_earned: "12.50",
        lifetime_spent: "0",
        lifetime_cashed_out: "0",
      },
    })
    assert.equal(total, 12.5)
    assert.equal(
      total,
      walletTotalBalanceUsd({
        balance: "10.00",
        pending_balance: "2.50",
        lifetime_earned: "12.50",
        lifetime_spent: "0",
        lifetime_cashed_out: "0",
      }),
    )
  })

  it("returns 0 when there is no wallet row and no error", () => {
    assert.equal(resolveHeaderWalletBalance({ data: null }), 0)
    assert.equal(resolveHeaderWalletBalance({ data: null, error: null }), 0)
  })

  it("returns 0 for PostgREST no-rows from .single()", () => {
    assert.equal(
      resolveHeaderWalletBalance({
        data: null,
        error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" },
      }),
      0,
    )
  })

  it("returns null when the wallet read failed for another reason", () => {
    assert.equal(
      resolveHeaderWalletBalance({
        data: null,
        error: { code: "42501", message: "permission denied for table wallets" },
      }),
      null,
    )
    assert.equal(
      resolveHeaderWalletBalance({
        data: null,
        error: { message: "Failed to fetch" },
      }),
      null,
    )
  })
})
