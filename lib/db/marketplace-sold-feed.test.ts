import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isSoldFeedSaleLineRpcMissing } from "@/lib/db/marketplace-sold-feed"

describe("marketplace sold feed RPC", () => {
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
})
