import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { listingSoldViaCheckoutUpdate } from "@/lib/listing-sold-state"

describe("listingSoldViaCheckoutUpdate", () => {
  it("stamps last_sold_at for seller sold-feed denorm", () => {
    const at = "2026-11-02T14:00:00.000Z"
    const update = listingSoldViaCheckoutUpdate(at)
    assert.equal(update.status, "sold")
    assert.equal(update.last_sold_at, at)
    assert.equal(update.updated_at, at)
    assert.equal(update.sold_off_platform, false)
  })
})
