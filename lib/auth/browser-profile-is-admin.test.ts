import assert from "node:assert/strict"
import { register } from "node:module"
import { describe, it } from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"

register(
  "data:text/javascript," +
    encodeURIComponent(`
import { pathToFileURL } from "node:url"
import { join } from "node:path"
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const abs = join(${JSON.stringify("/workspace")}, specifier.slice(2))
    const file = abs.endsWith(".ts") ? abs : abs + ".ts"
    return { url: pathToFileURL(file).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
`),
)

const { browserProfileIsAdmin } = await import("./browser-profile-is-admin.ts")

function mockSupabase(input: {
  user?: { id: string } | null
  isAdmin?: boolean
  getUserError?: Error
  profileError?: { message: string }
  getUserCalls?: { count: number }
}): SupabaseClient {
  const getUserCalls = input.getUserCalls ?? { count: 0 }
  return {
    auth: {
      getUser: async () => {
        getUserCalls.count += 1
        if (input.getUserError) {
          return { data: { user: null }, error: input.getUserError }
        }
        return { data: { user: input.user ?? null }, error: null }
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: input.profileError ? null : { is_admin: input.isAdmin === true },
            error: input.profileError ?? null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient
}

describe("browserProfileIsAdmin", () => {
  it("stays logged out when the header has no auth cookie", async () => {
    const calls = { count: 0 }
    const supabase = mockSupabase({ user: { id: "admin" }, isAdmin: true, getUserCalls: calls })
    assert.equal(await browserProfileIsAdmin(supabase, { hasAuthCookies: false }), false)
    assert.equal(calls.count, 0)
  })

  it("stays logged out when the cookie does not resolve to a user", async () => {
    const supabase = mockSupabase({ user: null, isAdmin: true })
    assert.equal(await browserProfileIsAdmin(supabase, { hasAuthCookies: true }), false)
  })

  it("is true only for an admin profile on this browser session", async () => {
    const admin = mockSupabase({ user: { id: "admin" }, isAdmin: true })
    const member = mockSupabase({ user: { id: "member" }, isAdmin: false })
    assert.equal(await browserProfileIsAdmin(admin, { hasAuthCookies: true }), true)
    assert.equal(await browserProfileIsAdmin(member, { hasAuthCookies: true }), false)
  })

  it("returns null when the browser auth call fails so the caller can fall back", async () => {
    const aborted = new Error("signal is aborted without reason")
    aborted.name = "AbortError"
    const supabase = mockSupabase({ getUserError: aborted })
    assert.equal(await browserProfileIsAdmin(supabase, { hasAuthCookies: true }), null)
  })
})
