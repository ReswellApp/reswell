import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  clearResolvedClientSessionCache,
  resolveClientSessionForMutation,
} from "./resolve-client-session-for-mutation.ts"

function sessionClient(options?: { delayMs?: number }) {
  let getSessionCalls = 0
  const session = {
    access_token: "token",
    refresh_token: "refresh",
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    user: { id: "user-1" },
  }
  const supabase = {
    auth: {
      getSession: async () => {
        getSessionCalls += 1
        if (options?.delayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.delayMs))
        }
        return { data: { session } }
      },
      getUser: async () => {
        throw new Error("getUser should not run when getSession already has a user")
      },
    },
  }
  return { supabase: supabase as unknown as SupabaseClient, getSessionCalls: () => getSessionCalls }
}

describe("resolveClientSessionForMutation", () => {
  it("shares one lookup across a photo batch", async () => {
    clearResolvedClientSessionCache()
    const client = sessionClient({ delayMs: 40 })

    const [first, second] = await Promise.all([
      resolveClientSessionForMutation(client.supabase),
      resolveClientSessionForMutation(client.supabase),
    ])

    assert.equal(first?.user.id, "user-1")
    assert.equal(second?.user.id, "user-1")
    assert.equal(client.getSessionCalls(), 1)

    const third = await resolveClientSessionForMutation(client.supabase)
    assert.equal(third?.user.id, "user-1")
    assert.equal(client.getSessionCalls(), 1)
    clearResolvedClientSessionCache()
  })
})
