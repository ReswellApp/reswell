import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { inboxTickerCount } from "./inbox-ticker-count.ts"

describe("inboxTickerCount", () => {
  it("matches the website header: messages plus support, not activity", () => {
    assert.equal(inboxTickerCount(2, 1), 3)
    assert.equal(inboxTickerCount(0, 0), 0)
    assert.equal(inboxTickerCount(-3, 4), 4)
  })
})
