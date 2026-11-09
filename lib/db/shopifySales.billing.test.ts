import assert from "node:assert/strict"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import { dbListShopifyBilledListingIds } from "@/lib/db/shopifySales"

type QueryResult = { data: unknown; error: { message: string } | null }

function query(result: QueryResult) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.in = chain
  builder.eq = chain
  builder.then = (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return builder
}

function client(results: Record<string, QueryResult>): SupabaseClient {
  return {
    from(table: string) {
      const result = results[table]
      if (!result) throw new Error(`unexpected table ${table}`)
      return query(result)
    },
  } as unknown as SupabaseClient
}

async function withoutServiceRole<T>(run: () => Promise<T>): Promise<T> {
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  try {
    return await run()
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous
  }
}

test("shopify billing lookup does not abort checkout when the buyer role cannot read mappings", async () => {
  const ids = await withoutServiceRole(() =>
    dbListShopifyBilledListingIds(
      client({
        shopify_product_mappings: {
          data: null,
          error: { message: "permission denied for table shopify_product_mappings" },
        },
      }),
      ["listing-1"],
    ),
  )
  assert.deepEqual(ids, [])
})

test("shopify billing lookup returns listings on an active billed connection", async () => {
  const ids = await withoutServiceRole(() =>
    dbListShopifyBilledListingIds(
      client({
        shopify_product_mappings: {
          data: [
            { listing_id: "listing-1", connection_id: "conn-1" },
            { listing_id: "listing-2", connection_id: "conn-2" },
          ],
          error: null,
        },
        shopify_connections: {
          data: [{ id: "conn-1" }],
          error: null,
        },
      }),
      ["listing-1", "listing-2"],
    ),
  )
  assert.deepEqual(ids, ["listing-1"])
})
