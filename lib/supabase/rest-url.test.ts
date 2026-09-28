import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isSupabaseRestUrl, supabaseReadRestUrl } from "./rest-url.ts"

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

describe("supabaseReadRestUrl", { concurrency: 1 }, () => {
  const previousPrimary = process.env.NEXT_PUBLIC_SUPABASE_URL
  const previousReplica = process.env.SUPABASE_READ_REPLICA_URL

  function restoreEnv(): void {
    if (previousPrimary === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousPrimary
    if (previousReplica === undefined) delete process.env.SUPABASE_READ_REPLICA_URL
    else process.env.SUPABASE_READ_REPLICA_URL = previousReplica
  }

  it("uses a valid replica API URL for lag-tolerant reads", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://primary.supabase.co"
    process.env.SUPABASE_READ_REPLICA_URL = "https://replica.supabase.co"
    try {
      assert.equal(supabaseReadRestUrl(), "https://replica.supabase.co")
    } finally {
      restoreEnv()
    }
  })

  it("stays on the primary when the replica URL is missing or a Postgres string", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://primary.supabase.co"
    delete process.env.SUPABASE_READ_REPLICA_URL
    try {
      assert.equal(supabaseReadRestUrl(), "https://primary.supabase.co")
      process.env.SUPABASE_READ_REPLICA_URL =
        "postgresql://postgres.abc:secret@host:5432/postgres"
      assert.equal(supabaseReadRestUrl(), "https://primary.supabase.co")
    } finally {
      restoreEnv()
    }
  })
})
