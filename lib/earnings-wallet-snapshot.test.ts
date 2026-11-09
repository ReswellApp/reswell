import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { earningsWalletSnapshotFromRow } from "./earnings-wallet-snapshot.ts"

describe("earningsWalletSnapshotFromRow", () => {
  it("formats wallet aggregates as fixed-point strings", () => {
    const snap = earningsWalletSnapshotFromRow({
      id: "w1",
      user_id: "u1",
      balance: 12.5,
      pending_balance: "4",
      lifetime_earned: 20,
      lifetime_spent: null,
      lifetime_cashed_out: 3.1,
    })
    assert.deepEqual(snap, {
      id: "w1",
      balance: "12.50",
      pending_balance: "4.00",
      lifetime_earned: "20.00",
      lifetime_spent: "0.00",
      lifetime_cashed_out: "3.10",
    })
  })
})
