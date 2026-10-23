import type { SupabaseClient } from "@supabase/supabase-js"
import { MARKETPLACE_SOLD_FEED_SECTIONS } from "@/lib/db/home-recently-sold-strip"

export const MARKETPLACE_SOLD_FEED_PAGE_SIZE = 40

export interface MarketplaceSoldFeedCursor {
  soldAt: string
  listingId: string
  /** Order line (or tip) that this tile represents. */
  saleLineId: string | null
}

interface SoldFeedOrderRow {
  listing_id: string
  sale_confirmed_at: string
  quantity?: number | string | null
  sale_line_id?: string | null
  line_total?: number | string | null
}

export interface MarketplaceSoldFeedSale {
  listingId: string
  soldAt: string
  quantity: number
  saleLineId: string
  lineTotal: number | null
}

export interface MarketplaceSoldFeedOrderPage {
  sales: MarketplaceSoldFeedSale[]
  hasMore: boolean
  nextCursor: MarketplaceSoldFeedCursor | null
}

function parseQuantity(value: number | string | null | undefined): number {
  const parsed = Math.floor(Number(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function parseLineTotal(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

type SoldFeedPageRpcArgs = {
  p_limit: number
  p_sections: string[]
  p_before_sale_at: string | null
  p_before_listing_id: string | null
  p_brand_id: string | null
  p_brand_name: string | null
  p_before_sale_line_id?: string
}

/** PostgREST: 7-arg sale-line overload is not in the schema cache yet. */
export function isSoldFeedSaleLineRpcMissing(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false
  const message = error.message ?? ""
  return (
    error.code === "PGRST202" ||
    (message.includes("marketplace_sold_listing_page") &&
      (message.includes("Could not find the function") || message.includes("schema cache")))
  )
}

async function rpcMarketplaceSoldListingPage(
  supabase: SupabaseClient,
  args: SoldFeedPageRpcArgs,
): Promise<{ data: SoldFeedOrderRow[] | null; error: { code?: string; message?: string } | null }> {
  const withSaleLine = args.p_before_sale_line_id
    ? await supabase.rpc("marketplace_sold_listing_page", args)
    : null

  if (withSaleLine && !withSaleLine.error) {
    return withSaleLine
  }

  if (withSaleLine?.error && !isSoldFeedSaleLineRpcMissing(withSaleLine.error)) {
    return withSaleLine
  }

  const { p_before_sale_line_id: _saleLineId, ...legacyArgs } = args
  if (withSaleLine?.error) {
    console.warn(
      "[fetchMarketplaceSoldFeedOrderPage] sale-line RPC missing; retrying without p_before_sale_line_id",
    )
  }

  return supabase.rpc("marketplace_sold_listing_page", legacyArgs)
}

/** Confirmed checkout lines for `/sold`, newest first. Eligibility lives in SQL. */
export async function fetchMarketplaceSoldFeedOrderPage(
  supabase: SupabaseClient,
  options: {
    cursor: MarketplaceSoldFeedCursor | null
    brand: { id: string; name: string } | null
    pageSize?: number
  },
): Promise<MarketplaceSoldFeedOrderPage> {
  const pageSize = options.pageSize ?? MARKETPLACE_SOLD_FEED_PAGE_SIZE
  const sections = options.brand
    ? ["new", ...MARKETPLACE_SOLD_FEED_SECTIONS]
    : [...MARKETPLACE_SOLD_FEED_SECTIONS]
  const rpcArgs: SoldFeedPageRpcArgs = {
    p_limit: pageSize + 1,
    p_sections: sections,
    p_before_sale_at: options.cursor?.soldAt ?? null,
    p_before_listing_id: options.cursor?.listingId ?? null,
    p_brand_id: options.brand?.id ?? null,
    p_brand_name: options.brand?.name ?? null,
  }
  if (options.cursor?.saleLineId) {
    rpcArgs.p_before_sale_line_id = options.cursor.saleLineId
  }

  const { data, error } = await rpcMarketplaceSoldListingPage(supabase, rpcArgs)

  if (error) {
    console.error("[fetchMarketplaceSoldFeedOrderPage]", error.message)
    throw new Error("Unable to load sold listings")
  }

  const rows = ((data ?? []) as SoldFeedOrderRow[]).slice(0, pageSize)
  const sales = rows.map((row) => ({
    listingId: row.listing_id,
    soldAt: row.sale_confirmed_at,
    quantity: parseQuantity(row.quantity),
    saleLineId: row.sale_line_id || row.listing_id,
    lineTotal: parseLineTotal(row.line_total),
  }))
  const lastRow = rows.at(-1)
  const lastSale = sales.at(-1)

  return {
    sales,
    hasMore: (data?.length ?? 0) > pageSize,
    nextCursor: lastRow && lastSale
      ? {
          soldAt: lastRow.sale_confirmed_at,
          listingId: lastRow.listing_id,
          saleLineId: lastSale.saleLineId,
        }
      : null,
  }
}
