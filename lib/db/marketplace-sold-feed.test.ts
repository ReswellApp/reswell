import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import {
  isSoldFeedSaleLineRpcMissing,
  MARKETPLACE_SOLD_FEED_ALL_SECTIONS,
} from "@/lib/db/marketplace-sold-feed"

function readRepo(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8")
}

describe("marketplace sold feed RPC", () => {
  it("includes shop retail with peer sections", () => {
    assert.equal(MARKETPLACE_SOLD_FEED_ALL_SECTIONS[0], "new")
    assert.ok(MARKETPLACE_SOLD_FEED_ALL_SECTIONS.includes("fins"))
    assert.ok(MARKETPLACE_SOLD_FEED_ALL_SECTIONS.includes("surfboards"))
  })

  it("detects a missing sale-line overload", () => {
    assert.equal(
      isSoldFeedSaleLineRpcMissing({
        code: "PGRST202",
        message: "Could not find the function",
      }),
      true,
    )
    assert.equal(
      isSoldFeedSaleLineRpcMissing({
        message:
          "Could not find the function public.marketplace_sold_listing_page(..., p_before_sale_line_id, ...) in the schema cache",
      }),
      true,
    )
    assert.equal(
      isSoldFeedSaleLineRpcMissing({ message: "permission denied for function marketplace_sold_listing_page" }),
      false,
    )
  })

  it("always sends p_before_sale_line_id so PostgREST cannot pick a 6-arg overload", () => {
    const src = readRepo("lib/db/marketplace-sold-feed.ts")
    assert.match(src, /p_before_sale_line_id:\s*options\.cursor\?\.saleLineId \?\? null/)
    assert.doesNotMatch(src, /if \(options\.cursor\?\.saleLineId\)/)
  })

  it("lets confirmed checkouts onto /sold even when the listing is hidden or pending_sale", () => {
    const sql = readRepo(
      "supabase/migrations/20271211120000_sold_feed_confirmed_checkout_visibility.sql",
    )
    assert.match(sql, /l\.status IN \('sold', 'active', 'pending_sale'\)/)
    assert.match(
      sql,
      /Confirmed checkouts are not gated on hidden_from_site/,
    )
    const checkoutArm = sql.slice(
      sql.indexOf("checkout_lines AS"),
      sql.indexOf("legacy_lines AS"),
    )
    assert.doesNotMatch(checkoutArm, /hidden_from_site/)
  })
})
