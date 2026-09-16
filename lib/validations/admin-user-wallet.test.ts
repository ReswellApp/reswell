import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { adminWalletCreditSchema } from "./admin-user-wallet.ts"

describe("adminWalletCreditSchema", () => {
  it("accepts amounts up to $250 without extra confirmation", () => {
    const parsed = adminWalletCreditSchema.parse({ amount_usd: 250 })
    assert.equal(parsed.amount_usd, 250)
  })

  it("rejects amounts over $250 unless confirm_over_limit is true", () => {
    const parsed = adminWalletCreditSchema.safeParse({ amount_usd: 250.01 })
    assert.equal(parsed.success, false)
  })

  it("accepts amounts over $250 when confirm_over_limit is true", () => {
    const parsed = adminWalletCreditSchema.parse({
      amount_usd: 251,
      confirm_over_limit: true,
    })
    assert.equal(parsed.amount_usd, 251)
  })

  it("rejects amounts over $5,000 even when confirmed", () => {
    const parsed = adminWalletCreditSchema.safeParse({
      amount_usd: 5000.01,
      confirm_over_limit: true,
    })
    assert.equal(parsed.success, false)
  })

  it("accepts an optional support case id for ticket history", () => {
    const parsed = adminWalletCreditSchema.parse({
      amount_usd: 40,
      support_case_id: "11111111-1111-1111-1111-111111111111",
    })
    assert.equal(parsed.support_case_id, "11111111-1111-1111-1111-111111111111")
  })
})
