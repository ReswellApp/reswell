import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  signComposerUnlockToken,
  verifyComposerUnlockToken,
  verifyLiveChatComposerUnlock,
  verifyMarketplaceComposerUnlock,
} from "./composerUnlock.ts"

describe("composer unlock token", () => {
  it("round-trips a marketplace token for the same user", () => {
    const issued = signComposerUnlockToken({ scope: "marketplace", sub: "user-1" })
    assert.ok(issued)
    const verified = verifyComposerUnlockToken(issued.token, {
      scope: "marketplace",
      sub: "user-1",
    })
    assert.equal(verified.ok, true)
    assert.equal(verifyMarketplaceComposerUnlock(issued.token, "user-1"), true)
  })

  it("rejects a token for a different user or scope", () => {
    const issued = signComposerUnlockToken({ scope: "marketplace", sub: "user-1" })
    assert.ok(issued)
    assert.equal(verifyMarketplaceComposerUnlock(issued.token, "user-2"), false)
    assert.equal(
      verifyComposerUnlockToken(issued.token, { scope: "live-chat", sub: "user-1" }).ok,
      false,
    )
  })

  it("rejects a tampered signature", () => {
    const issued = signComposerUnlockToken({ scope: "marketplace", sub: "user-1" })
    assert.ok(issued)
    assert.equal(verifyMarketplaceComposerUnlock(`${issued.token}x`, "user-1"), false)
  })

  it("rejects an expired token", () => {
    const issued = signComposerUnlockToken({
      scope: "marketplace",
      sub: "user-1",
      nowMs: Date.now() - 10_000,
      ttlMs: 1_000,
    })
    assert.ok(issued)
    assert.equal(verifyMarketplaceComposerUnlock(issued.token, "user-1"), false)
  })

  it("binds live-chat tokens to the visitor and optional session", () => {
    const visitor = "11111111-1111-4111-8111-111111111111"
    const loose = signComposerUnlockToken({
      scope: "live-chat",
      sub: visitor,
    })
    assert.ok(loose)
    assert.equal(verifyLiveChatComposerUnlock(loose.token, visitor, "sess_abc"), true)

    const bound = signComposerUnlockToken({
      scope: "live-chat",
      sub: visitor,
      sessionPublicId: "sess_abc",
    })
    assert.ok(bound)
    assert.equal(verifyLiveChatComposerUnlock(bound.token, visitor, "sess_abc"), true)
    assert.equal(verifyLiveChatComposerUnlock(bound.token, visitor, "sess_other"), false)
  })
})
