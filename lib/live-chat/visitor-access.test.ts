import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { liveChatVisitorAccessDecision } from "./visitor-access.ts"

describe("liveChatVisitorAccessDecision", () => {
  it("allows anyone when the widget is public", () => {
    assert.deepEqual(
      liveChatVisitorAccessDecision({ adminOnly: false, signedIn: false, isAdmin: false }),
      { ok: true },
    )
  })

  it("requires a signed-in admin while the widget is admin-only", () => {
    assert.deepEqual(
      liveChatVisitorAccessDecision({ adminOnly: true, signedIn: false, isAdmin: false }),
      { ok: false, error: "Sign in required", status: 401 },
    )
    assert.deepEqual(
      liveChatVisitorAccessDecision({ adminOnly: true, signedIn: true, isAdmin: false }),
      { ok: false, error: "Admin only", status: 403 },
    )
    assert.deepEqual(
      liveChatVisitorAccessDecision({ adminOnly: true, signedIn: true, isAdmin: true }),
      { ok: true },
    )
  })
})
