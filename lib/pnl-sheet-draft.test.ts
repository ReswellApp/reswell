import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { PnlEntryRow } from "./db/pnl.ts"
import { draftFromEntry, draftIsDirty, draftToUpdatePayload } from "./pnl-sheet-draft.ts"

function entry(overrides: Partial<PnlEntryRow> = {}): PnlEntryRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    board_name: "Album Twinsman",
    category: "twin",
    status: "listed",
    source_kind: "outside",
    bought_from: null,
    purchase_price: 0,
    purchase_date: null,
    asking_price: 850,
    sale_price: null,
    sale_date: null,
    shipping_cost: 0,
    platform_fee: 0,
    other_costs: 0,
    notes: null,
    order_id: null,
    listing_id: null,
    order_role: null,
    order_num: null,
    listing_slug: null,
    created_by: "staff",
    created_at: "2026-09-21T00:00:00.000Z",
    updated_at: "2026-09-21T00:00:00.000Z",
    ...overrides,
  }
}

describe("pnl sheet draft", () => {
  it("is clean until a cost is entered", () => {
    const row = entry()
    const draft = draftFromEntry(row)
    assert.equal(draftIsDirty(draft, row), false)
    draft.purchase_price = "425"
    assert.equal(draftIsDirty(draft, row), true)
    const payload = draftToUpdatePayload(draft, row)
    assert.equal(payload?.purchasePrice, 425)
    assert.equal(payload?.status, "listed")
  })

  it("marks the board sold when a sale price is entered", () => {
    const row = entry()
    const draft = draftFromEntry(row)
    draft.sale_price = "900"
    const payload = draftToUpdatePayload(draft, row)
    assert.equal(payload?.salePrice, 900)
    assert.equal(payload?.status, "sold")
  })
})
