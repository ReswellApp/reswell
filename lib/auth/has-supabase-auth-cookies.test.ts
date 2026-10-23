import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import {
  clearSupabaseAuthCookiesClient,
  hasSupabaseAuthCookiesClient,
} from "./has-supabase-auth-cookies.ts"

describe("supabase auth cookies in the browser", () => {
  const previousDocument = (globalThis as { document?: unknown }).document

  afterEach(() => {
    ;(globalThis as { document?: unknown }).document = previousDocument
  })

  it("ignores an empty auth cookie left by a failed deletion", () => {
    installCookie("sb-abc-auth-token=; rw_did=1")
    assert.equal(hasSupabaseAuthCookiesClient(), false)
    installCookie("sb-abc-auth-token=session; rw_did=1")
    assert.equal(hasSupabaseAuthCookiesClient(), true)
  })

  it("expires auth cookies with Expires and SameSite, including the secure variant on https", () => {
    const writes: string[] = []
    installCookie("sb-abc-auth-token.0=aaa; sb-abc-auth-token.1=bbb; theme=dark", writes, "https:")
    clearSupabaseAuthCookiesClient()
    assert.deepEqual(writes, [
      "sb-abc-auth-token.0=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax",
      "sb-abc-auth-token.0=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax; secure",
      "sb-abc-auth-token.1=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax",
      "sb-abc-auth-token.1=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax; secure",
    ])
  })
})

function installCookie(initial: string, writes?: string[], protocol = "https:"): void {
  let cookie = initial
  const document = {}
  Object.defineProperty(document, "cookie", {
    get() {
      return cookie
    },
    set(value: string) {
      writes?.push(value)
      cookie = value
    },
  })
  const target = globalThis as { document?: unknown; location?: unknown }
  target.document = document
  target.location = { protocol }
}
