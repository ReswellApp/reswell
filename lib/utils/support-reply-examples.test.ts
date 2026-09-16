import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  SUPPORT_REPLY_EXAMPLES_PATH,
  clampSupportReplyExamplesPage,
  supportReplyExampleSearchOrClause,
  supportReplyExampleSearchPattern,
  supportReplyExamplesHref,
} from "./support-reply-examples.ts"

describe("support reply examples href", () => {
  it("returns the bare path when filters are empty", () => {
    assert.equal(supportReplyExamplesHref({}), SUPPORT_REPLY_EXAMPLES_PATH)
    assert.equal(supportReplyExamplesHref({ page: 1, q: "  " }), SUPPORT_REPLY_EXAMPLES_PATH)
  })

  it("omits page 1 and keeps later pages", () => {
    assert.equal(
      supportReplyExamplesHref({ rating: "bad", page: 2 }),
      `${SUPPORT_REPLY_EXAMPLES_PATH}?rating=bad&page=2`,
    )
  })

  it("trims search text", () => {
    assert.equal(
      supportReplyExamplesHref({ q: "  tracking  ", kind: "order_question" }),
      `${SUPPORT_REPLY_EXAMPLES_PATH}?kind=order_question&q=tracking`,
    )
  })
})

describe("clamp support reply examples page", () => {
  it("drops a now-empty last page after a delete", () => {
    assert.equal(clampSupportReplyExamplesPage(2, 25, 25), 1)
    assert.equal(clampSupportReplyExamplesPage(3, 26, 25), 2)
  })

  it("keeps a page that still has rows", () => {
    assert.equal(clampSupportReplyExamplesPage(2, 26, 25), 2)
    assert.equal(clampSupportReplyExamplesPage(1, 0, 25), 1)
  })

  it("floors invalid pages to 1", () => {
    assert.equal(clampSupportReplyExamplesPage(0, 50, 25), 1)
    assert.equal(clampSupportReplyExamplesPage(-2, 50, 25), 1)
  })
})

describe("support reply example search pattern", () => {
  it("keeps commas, periods, and parentheses", () => {
    assert.equal(supportReplyExampleSearchPattern("Hi, thanks."), "Hi, thanks.")
    assert.equal(supportReplyExampleSearchPattern("refund (UPS)"), "refund (UPS)")
    assert.equal(
      supportReplyExampleSearchOrClause("Hi, thanks."),
      'customer_excerpt.ilike."%Hi, thanks.%",staff_reply.ilike."%Hi, thanks.%"',
    )
  })

  it("escapes ilike wildcards instead of deleting them", () => {
    assert.equal(supportReplyExampleSearchPattern("100% refund_"), "100\\% refund\\_")
  })

  it("does not treat punctuation-only text as no search", () => {
    assert.equal(supportReplyExampleSearchPattern("..."), "...")
    assert.equal(supportReplyExampleSearchPattern("   "), null)
  })

  it("matches stored body for thanks. and Hi, Hayden", () => {
    const staffReply = "Hi, Hayden — tracking is live. thanks."
    const customerExcerpt = "Hi, Hayden, where is my board?"
    const thanks = supportReplyExampleSearchPattern("thanks.")
    const greeting = supportReplyExampleSearchPattern("Hi, Hayden")
    assert.ok(thanks)
    assert.ok(greeting)
    assert.ok(staffReply.toLowerCase().includes(thanks.toLowerCase()))
    assert.ok(staffReply.toLowerCase().includes(greeting.toLowerCase()))
    assert.ok(customerExcerpt.toLowerCase().includes(greeting.toLowerCase()))
    assert.ok(supportReplyExampleSearchOrClause("thanks.")?.includes("thanks."))
  })
})
