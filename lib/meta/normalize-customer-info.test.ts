import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { normalizeMetaEmail } from "./normalize-customer-info.ts"
import {
  buyerEmailFromPaymentIntentMetadata,
  firstNonEmptyEmail,
  stripeBuyerEmailMetadata,
} from "./stripe-buyer-email-metadata.ts"

describe("normalizeMetaEmail", () => {
  it("lowercases and trims", () => {
    assert.equal(normalizeMetaEmail("  Foo.Bar@Example.COM "), "foo.bar@example.com")
  })

  it("strips Gmail dots and plus aliases", () => {
    assert.equal(normalizeMetaEmail("John.Doe+ads@gmail.com"), "johndoe@gmail.com")
    assert.equal(normalizeMetaEmail("a.b+c@googlemail.com"), "ab@gmail.com")
  })

  it("rejects empty or malformed values", () => {
    assert.equal(normalizeMetaEmail(""), null)
    assert.equal(normalizeMetaEmail("   "), null)
    assert.equal(normalizeMetaEmail("no-at-sign"), null)
    assert.equal(normalizeMetaEmail("@onlydomain.com"), null)
  })
})

describe("stripe buyer email metadata", () => {
  it("builds and reads buyer_email metadata", () => {
    assert.deepEqual(stripeBuyerEmailMetadata(" buyer@reswell.app "), {
      buyer_email: "buyer@reswell.app",
    })
    assert.deepEqual(stripeBuyerEmailMetadata(null), {})
    assert.equal(
      buyerEmailFromPaymentIntentMetadata({ buyer_email: "a@b.co" }),
      "a@b.co",
    )
    assert.equal(buyerEmailFromPaymentIntentMetadata({}), null)
  })

  it("picks the first non-empty email", () => {
    assert.equal(firstNonEmptyEmail(null, "  ", "keep@x.com", "skip@y.com"), "keep@x.com")
    assert.equal(firstNonEmptyEmail(undefined, null, ""), null)
  })
})
