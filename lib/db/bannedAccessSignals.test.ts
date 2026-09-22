import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"

import {
  findActiveBannedAccessSignal,
  isAccessSignalSchemaCacheError,
  isAccessSignalSchemaUnavailable,
  resetAccessSignalSchemaCircuit,
} from "./bannedAccessSignals.ts"

afterEach(() => {
  resetAccessSignalSchemaCircuit()
})

describe("isAccessSignalSchemaCacheError", () => {
  it("matches PostgREST missing-table codes and messages", () => {
    assert.equal(isAccessSignalSchemaCacheError({ code: "PGRST205" }), true)
    assert.equal(
      isAccessSignalSchemaCacheError({
        message: "Could not find the table 'public.banned_access_signals' in the schema cache",
      }),
      true,
    )
    assert.equal(
      isAccessSignalSchemaCacheError({
        message: "Could not find the table 'public.user_access_signals' in the schema cache",
      }),
      true,
    )
    assert.equal(
      isAccessSignalSchemaCacheError({
        message: "Could not find the table 'public.listings' in the schema cache",
      }),
      false,
    )
    assert.equal(isAccessSignalSchemaCacheError({ message: "JWT expired" }), false)
  })
})

describe("access signal schema circuit", () => {
  it("skips further lookups after a schema-cache miss", async () => {
    let calls = 0
    const supabase = {
      from() {
        calls += 1
        return {
          select() {
            return this
          },
          eq() {
            return this
          },
          maybeSingle: async () => ({
            data: null,
            error: {
              code: "PGRST205",
              message: "Could not find the table 'public.banned_access_signals' in the schema cache",
            },
          }),
        }
      },
    }

    const first = await findActiveBannedAccessSignal(
      supabase as never,
      "ip",
      "abc",
    )
    const second = await findActiveBannedAccessSignal(
      supabase as never,
      "device",
      "def",
    )

    assert.equal(first, null)
    assert.equal(second, null)
    assert.equal(calls, 1)
    assert.equal(isAccessSignalSchemaUnavailable(), true)
  })
})
