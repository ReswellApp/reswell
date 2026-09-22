import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isSupabaseRestUrl } from "./rest-url.ts"

describe("isSupabaseRestUrl", () => {
  it("accepts HTTP and HTTPS API hosts", () => {
    assert.equal(isSupabaseRestUrl("https://abc.supabase.co"), true)
    assert.equal(isSupabaseRestUrl("http://localhost:54321"), true)
  })

  it("rejects Postgres connection strings and host-only values", () => {
    assert.equal(
      isSupabaseRestUrl("postgresql://postgres.abc:secret@host:5432/postgres"),
      false,
    )
    assert.equal(isSupabaseRestUrl("postgres://localhost:5432/postgres"), false)
    assert.equal(isSupabaseRestUrl("abc.supabase.co"), false)
    assert.equal(isSupabaseRestUrl("https://"), false)
  })
})
