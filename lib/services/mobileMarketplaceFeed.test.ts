import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mobileMarketplaceFeedQuerySchema } from "@reswell/api-contract"
import { marketplaceFeedStats } from "./mobileMarketplaceFeedCopy.ts"

describe("mobile marketplace feed", () => {
  it("opens on the newest listings page", () => {
    const parsed = mobileMarketplaceFeedQuerySchema.parse({})
    assert.equal(parsed.tab, "new")
    assert.equal(parsed.page, 1)
  })

  it("rejects a sold cursor on the new listings feed and a sold page without a cursor", () => {
    const cursorOnNew = mobileMarketplaceFeedQuerySchema.safeParse({
      tab: "new",
      sold_at: "2026-10-01T00:00:00.000Z",
      listing_id: "6d8b6c3e-1f4a-4c2d-9a7b-0e5f1a2b3c4d",
    })
    assert.equal(cursorOnNew.success, false)

    const pageWithoutCursor = mobileMarketplaceFeedQuerySchema.safeParse({
      tab: "sold",
      page: 2,
    })
    assert.equal(pageWithoutCursor.success, false)

    const halfCursor = mobileMarketplaceFeedQuerySchema.safeParse({
      tab: "sold",
      sold_at: "2026-10-01T00:00:00.000Z",
    })
    assert.equal(halfCursor.success, false)
  })

  it("writes the same headline counts the website feed shows", () => {
    assert.equal(
      marketplaceFeedStats("new", 1, null).caption,
      "1 active listing on Reswell",
    )
    assert.equal(
      marketplaceFeedStats("sold", 1200, "$1.2M").caption,
      "1,200 items sold on Reswell · $1.2M in sales",
    )
    assert.equal(
      marketplaceFeedStats("shipped", 86, null).caption,
      "86 shipped boards on Reswell",
    )
  })
})
