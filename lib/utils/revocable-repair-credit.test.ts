import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { revocableRepairCreditUsd } from "./revocable-repair-credit.ts"

describe("revocable repair credit", () => {
  it("takes back the full grant when the wallet still holds it", () => {
    assert.equal(revocableRepairCreditUsd(80, 80), 80)
    assert.equal(revocableRepairCreditUsd(80, 200), 80)
  })

  it("only takes back what is still sitting in the wallet", () => {
    assert.equal(revocableRepairCreditUsd(80, 20), 20)
    assert.equal(revocableRepairCreditUsd(80, 0), 0)
  })

  it("never goes negative", () => {
    assert.equal(revocableRepairCreditUsd(80, -5), 0)
    assert.equal(revocableRepairCreditUsd(-10, 40), 0)
  })
})
