import assert from "node:assert/strict"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"

import { PEER_SURFBOARD_CHECKOUT_LISTING_SELECT } from "@/lib/services/peerListingShippingQuote"
import { isShopifyManagedListing } from "@/lib/shopify/listing"
import {
  LISTING_CART_ELIGIBILITY_SELECT,
  fetchInventorySourceByListingId,
  isMissingInventorySourceColumn,
  withShopifyInventorySources,
} from "@/lib/shopify/listing-inventory-source"

type QueryResult = {
  data: unknown
  error: { code?: string; message?: string } | null
}

function fakeClient(responses: Record<string, QueryResult>, calls: string[]): SupabaseClient {
  return {
    from(table: string) {
      const builder = {
        select(columns: string) {
          calls.push(`${table}.select:${columns}`)
          return builder
        },
        in(column: string, values: string[]) {
          calls.push(`${table}.in:${column}:${values.join(",")}`)
          return builder
        },
        eq(column: string, value: string) {
          calls.push(`${table}.eq:${column}:${value}`)
          return builder
        },
        then(resolve: (value: QueryResult) => void) {
          resolve(responses[table] ?? { data: [], error: null })
        },
      }
      return builder
    },
  } as unknown as SupabaseClient
}

test("purchase selects do not name inventory_source", () => {
  assert.equal(LISTING_CART_ELIGIBILITY_SELECT.includes("inventory_source"), false)
  assert.equal(PEER_SURFBOARD_CHECKOUT_LISTING_SELECT.includes("inventory_source"), false)
})

test("a missing inventory_source column is the production 42703", () => {
  assert.equal(
    isMissingInventorySourceColumn({
      code: "42703",
      message: "column listings.inventory_source does not exist",
    }),
    true,
  )
  assert.equal(isMissingInventorySourceColumn({ code: "42501", message: "permission denied" }), false)
})

test("missing or null inventory_source is a native Reswell listing", () => {
  assert.equal(isShopifyManagedListing({}), false)
  assert.equal(isShopifyManagedListing({ inventory_source: null }), false)
  assert.equal(isShopifyManagedListing({ inventory_source: "reswell" }), false)
  assert.equal(isShopifyManagedListing({ inventory_source: "shopify" }), true)
})

test("does not read inventory_source when the seller has no Shopify connection", async () => {
  const calls: string[] = []
  const supabase = fakeClient(
    {
      shopify_connections: { data: [], error: null },
    },
    calls,
  )
  const sources = await fetchInventorySourceByListingId(supabase, [
    { id: "lost-asym", user_id: "hayden-shop" },
    { id: "lane-splitter", user_id: "hayden-shop" },
  ])
  assert.equal(sources.size, 0)
  assert.equal(calls.some((call) => call.startsWith("listings.")), false)
})

test("a missing column on a connected seller stays a native listing", async () => {
  const supabase = fakeClient(
    {
      shopify_connections: { data: [{ user_id: "connected-shop" }], error: null },
      listings: {
        data: null,
        error: { code: "42703", message: "column listings.inventory_source does not exist" },
      },
    },
    [],
  )
  const [listing] = await withShopifyInventorySources(supabase, [
    { id: "board-1", user_id: "connected-shop", section: "surfboards" },
  ])
  assert.ok(listing)
  assert.equal(listing.inventory_source, null)
  assert.equal(isShopifyManagedListing(listing), false)
})

test("reads inventory_source only for the connected seller", async () => {
  const calls: string[] = []
  const supabase = fakeClient(
    {
      shopify_connections: { data: [{ user_id: "connected-shop" }], error: null },
      listings: {
        data: [{ id: "shopify-board", inventory_source: "shopify" }],
        error: null,
      },
    },
    calls,
  )
  const sources = await fetchInventorySourceByListingId(supabase, [
    { id: "shopify-board", user_id: "connected-shop" },
    { id: "native-board", user_id: "hayden-shop" },
  ])
  assert.equal(sources.get("shopify-board"), "shopify")
  assert.equal(sources.has("native-board"), false)
  assert.equal(calls.includes("listings.in:id:shopify-board"), true)
  assert.equal(calls.some((call) => call.includes("native-board")), false)
})
