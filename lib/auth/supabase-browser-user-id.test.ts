import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readSupabaseUserIdFromCookieHeader } from "./supabase-browser-user-id.ts"

const NOW = Date.parse("2026-10-18T00:00:00.000Z")
const USER_ID = "11111111-1111-4111-8111-111111111111"

function base64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url")
}

function sessionCookie(session: unknown): string {
  return `base64-${base64Url(JSON.stringify(session))}`
}

describe("readSupabaseUserIdFromCookieHeader", () => {
  it("reads the user id from a base64 Supabase auth cookie", () => {
    const header = `sb-abc123-auth-token=${sessionCookie({
      expires_at: Math.floor(NOW / 1000) + 3600,
      user: { id: USER_ID },
    })}`
    assert.equal(readSupabaseUserIdFromCookieHeader(header, NOW), USER_ID)
  })

  it("joins chunked auth cookies in order", () => {
    const encoded = sessionCookie({
      expires_at: Math.floor(NOW / 1000) + 60,
      user: { id: USER_ID },
    })
    const splitAt = Math.floor(encoded.length / 2)
    const header = [
      `sb-abc123-auth-token.0=${encoded.slice(0, splitAt)}`,
      `theme=light`,
      `sb-abc123-auth-token.1=${encoded.slice(splitAt)}`,
    ].join("; ")
    assert.equal(readSupabaseUserIdFromCookieHeader(header, NOW), USER_ID)
  })

  it("falls back to the access token subject", () => {
    const payload = base64Url(JSON.stringify({ sub: USER_ID, exp: Math.floor(NOW / 1000) + 60 }))
    const header = `sb-abc123-auth-token=${sessionCookie({
      access_token: `header.${payload}.sig`,
    })}`
    assert.equal(readSupabaseUserIdFromCookieHeader(header, NOW), USER_ID)
  })

  it("ignores an expired session", () => {
    const header = `sb-abc123-auth-token=${sessionCookie({
      expires_at: Math.floor(NOW / 1000) - 5,
      user: { id: USER_ID },
    })}`
    assert.equal(readSupabaseUserIdFromCookieHeader(header, NOW), null)
  })

  it("returns null when the header has no auth cookie", () => {
    assert.equal(readSupabaseUserIdFromCookieHeader("theme=light", NOW), null)
    assert.equal(readSupabaseUserIdFromCookieHeader("", NOW), null)
    assert.equal(readSupabaseUserIdFromCookieHeader("sb-abc123-auth-token=not-json", NOW), null)
  })
})
