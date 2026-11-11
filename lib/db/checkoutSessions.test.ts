import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isMissingCheckoutSessionsRelation } from "@/lib/db/checkoutSessions"

describe("isMissingCheckoutSessionsRelation", () => {
  it("detects PostgREST and Postgres missing-table errors", () => {
    assert.equal(isMissingCheckoutSessionsRelation({ code: "PGRST205" }), true)
    assert.equal(isMissingCheckoutSessionsRelation({ code: "42P01" }), true)
    assert.equal(
      isMissingCheckoutSessionsRelation({
        message: "Could not find the table 'public.checkout_sessions' in the schema cache",
      }),
      true,
    )
    assert.equal(isMissingCheckoutSessionsRelation({ code: "42501", message: "permission denied" }), false)
  })
})
