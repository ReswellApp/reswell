import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  dbMarkListingsSoldViaCheckout,
} from "@/lib/db/listingSoldViaCheckout"
import { isListingLastSoldAtColumnMissing } from "@/lib/db/seller-profile-sold-listings"
import { listingSoldViaCheckoutUpdate } from "@/lib/listing-sold-state"

function mockSupabase(sequence: Array<{ error: { code?: string; message: string } | null }>) {
  const updates: unknown[] = []
  let call = 0
  const api = {
    from(_table: string) {
      return {
        update(payload: unknown) {
          updates.push(payload)
          return {
            in(_col: string, _ids: string[]) {
              const next = sequence[call] ?? { error: null }
              call += 1
              return Promise.resolve(next)
            },
            eq(_col: string, _val: string) {
              const next = sequence[call] ?? { error: null }
              call += 1
              return Promise.resolve(next)
            },
          }
        },
      }
    },
  }
  return { client: api as never, updates }
}

describe("listing sold via checkout / last_sold_at gap", () => {
  it("detects PostgREST missing last_sold_at column errors", () => {
    assert.equal(
      isListingLastSoldAtColumnMissing({
        code: "PGRST204",
        message: "Could not find the 'last_sold_at' column of 'listings' in the schema cache",
      }),
      true,
    )
    assert.equal(
      isListingLastSoldAtColumnMissing({
        code: "42703",
        message: "column listings.last_sold_at does not exist",
      }),
      true,
    )
    assert.equal(
      isListingLastSoldAtColumnMissing({
        code: "23505",
        message: "duplicate key value",
      }),
      false,
    )
  })

  it("keeps last_sold_at on the primary sold payload", () => {
    const at = "2026-11-03T15:00:00.000Z"
    const update = listingSoldViaCheckoutUpdate(at)
    assert.equal(update.last_sold_at, at)
    assert.equal(update.status, "sold")
  })

  it("retries mark-sold without last_sold_at when the column is missing", async () => {
    const { client, updates } = mockSupabase([
      {
        error: {
          code: "PGRST204",
          message: "Could not find the 'last_sold_at' column of 'listings' in the schema cache",
        },
      },
      { error: null },
    ])

    const result = await dbMarkListingsSoldViaCheckout(client, ["listing-1"])
    assert.equal(result.ok, true)
    assert.equal(updates.length, 2)
    assert.equal("last_sold_at" in (updates[0] as object), true)
    assert.equal("last_sold_at" in (updates[1] as object), false)
    assert.equal((updates[1] as { status: string }).status, "sold")
  })

  it("does not retry on unrelated update errors", async () => {
    const { client, updates } = mockSupabase([
      { error: { code: "42501", message: "permission denied" } },
    ])

    const result = await dbMarkListingsSoldViaCheckout(client, ["listing-1"])
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /permission denied/)
    assert.equal(updates.length, 1)
  })
})
