import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  fetchMarketplaceSoldFeedOrderPage,
  isSoldFeedSaleLineRpcMissing,
} from "./marketplace-sold-feed.ts"

const LISTING_ID = "11111111-1111-4111-8111-111111111111"
const SALE_LINE_ID = "22222222-2222-4222-8222-222222222222"
const SOLD_AT = "2026-10-22T12:00:00+00:00"

const PRODUCTION_MISSING_SALE_LINE_RPC = {
  code: "PGRST202",
  message:
    "Could not find the function public.marketplace_sold_listing_page(p_before_listing_id, p_before_sale_at, p_before_sale_line_id, p_brand_id, p_brand_name, p_limit, p_sections) in the schema cache",
}

function createRpcClient(
  handler: (fn: string, args: Record<string, unknown>) => { data: unknown; error: unknown },
) {
  return {
    rpc: async (fn: string, args: Record<string, unknown>) => handler(fn, args),
  }
}

describe("isSoldFeedSaleLineRpcMissing", () => {
  it("matches the live PostgREST miss for the sale-line overload", () => {
    assert.equal(isSoldFeedSaleLineRpcMissing(PRODUCTION_MISSING_SALE_LINE_RPC), true)
    assert.equal(isSoldFeedSaleLineRpcMissing({ code: "PGRST202" }), true)
    assert.equal(isSoldFeedSaleLineRpcMissing({ message: "permission denied" }), false)
    assert.equal(isSoldFeedSaleLineRpcMissing(null), false)
  })
})

describe("fetchMarketplaceSoldFeedOrderPage", () => {
  it("omits p_before_sale_line_id on the first page so the old 6-arg RPC still matches", async () => {
    const calls: Record<string, unknown>[] = []
    const supabase = createRpcClient((_fn, args) => {
      calls.push(args)
      return {
        data: [{ listing_id: LISTING_ID, sale_confirmed_at: SOLD_AT }],
        error: null,
      }
    })

    const page = await fetchMarketplaceSoldFeedOrderPage(supabase as never, {
      cursor: null,
      brand: null,
    })

    assert.equal(calls.length, 1)
    assert.equal("p_before_sale_line_id" in calls[0]!, false)
    assert.equal(page.sales[0]?.listingId, LISTING_ID)
    assert.equal(page.sales[0]?.quantity, 1)
    assert.equal(page.sales[0]?.saleLineId, LISTING_ID)
    assert.equal(page.sales[0]?.lineTotal, null)
  })

  it("retries without the sale-line cursor when that overload is missing", async () => {
    const calls: Record<string, unknown>[] = []
    const supabase = createRpcClient((_fn, args) => {
      calls.push(args)
      if ("p_before_sale_line_id" in args) {
        return { data: null, error: PRODUCTION_MISSING_SALE_LINE_RPC }
      }
      return {
        data: [{ listing_id: LISTING_ID, sale_confirmed_at: SOLD_AT }],
        error: null,
      }
    })

    const page = await fetchMarketplaceSoldFeedOrderPage(supabase as never, {
      cursor: {
        soldAt: SOLD_AT,
        listingId: LISTING_ID,
        saleLineId: SALE_LINE_ID,
      },
      brand: null,
    })

    assert.equal(calls.length, 2)
    assert.equal(calls[0]?.p_before_sale_line_id, SALE_LINE_ID)
    assert.equal("p_before_sale_line_id" in calls[1]!, false)
    assert.equal(page.sales[0]?.listingId, LISTING_ID)
  })

  it("keeps quantity tiles when the sale-line RPC is present", async () => {
    const supabase = createRpcClient(() => ({
      data: [
        {
          listing_id: LISTING_ID,
          sale_confirmed_at: SOLD_AT,
          quantity: 3,
          sale_line_id: SALE_LINE_ID,
          line_total: "90.00",
        },
      ],
      error: null,
    }))

    const page = await fetchMarketplaceSoldFeedOrderPage(supabase as never, {
      cursor: {
        soldAt: SOLD_AT,
        listingId: LISTING_ID,
        saleLineId: SALE_LINE_ID,
      },
      brand: null,
    })

    assert.equal(page.sales[0]?.quantity, 3)
    assert.equal(page.sales[0]?.saleLineId, SALE_LINE_ID)
    assert.equal(page.sales[0]?.lineTotal, 90)
    assert.equal(page.nextCursor?.saleLineId, SALE_LINE_ID)
  })

  it("still throws on a real sold-feed RPC failure", async () => {
    const supabase = createRpcClient(() => ({
      data: null,
      error: { message: "permission denied for function marketplace_sold_listing_page" },
    }))

    await assert.rejects(
      () =>
        fetchMarketplaceSoldFeedOrderPage(supabase as never, {
          cursor: null,
          brand: null,
        }),
      /Unable to load sold listings/,
    )
  })
})
