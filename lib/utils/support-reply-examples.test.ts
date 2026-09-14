import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { SUPPORT_REPLY_EXAMPLES_PATH, supportReplyExamplesHref } from "./support-reply-examples.ts"

describe("support reply examples href", () => {
  it("returns the bare path when filters are empty", () => {
    assert.equal(supportReplyExamplesHref({}), SUPPORT_REPLY_EXAMPLES_PATH)
    assert.equal(supportReplyExamplesHref({ page: 1, q: "  " }), SUPPORT_REPLY_EXAMPLES_PATH)
  })

  it("omits page 1 and keeps later pages", () => {
    assert.equal(
      supportReplyExamplesHref({ rating: "rejected", page: 2 }),
      `${SUPPORT_REPLY_EXAMPLES_PATH}?rating=rejected&page=2`,
    )
  })

  it("trims search text", () => {
    assert.equal(
      supportReplyExamplesHref({ q: "  tracking  ", kind: "order_question" }),
      `${SUPPORT_REPLY_EXAMPLES_PATH}?kind=order_question&q=tracking`,
    )
  })
})
