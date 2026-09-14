import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  SUPPORT_REPLY_EXAMPLES_PATH,
  clampSupportReplyExamplesPage,
  supportReplyExamplesHref,
} from "./support-reply-examples.ts"

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
