import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  SUPPORT_REPLY_EXAMPLE_PAGE_SIZE,
  supportReplyExampleDeleteSchema,
  supportReplyExampleListSchema,
  supportReplyExampleUpdateSchema,
} from "./supportReplyDraft.ts"

describe("support reply example review schemas", () => {
  it("lists with empty search params and defaults page/limit later", () => {
    const parsed = supportReplyExampleListSchema.safeParse({})
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.rating, undefined)
    assert.equal(parsed.data.kind, undefined)
    assert.equal(parsed.data.q, undefined)
    assert.equal(parsed.data.page, undefined)
    assert.equal(SUPPORT_REPLY_EXAMPLE_PAGE_SIZE, 25)
  })

  it("coerces page and treats blank rating as unset", () => {
    const parsed = supportReplyExampleListSchema.safeParse({
      rating: "",
      kind: "order_question",
      q: "  tracking  ",
      page: "2",
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.rating, undefined)
    assert.equal(parsed.data.kind, "order_question")
    assert.equal(parsed.data.q, "tracking")
    assert.equal(parsed.data.page, 2)
  })

  it("rejects an unknown kind filter", () => {
    const parsed = supportReplyExampleListSchema.safeParse({ kind: "not-a-kind" })
    assert.equal(parsed.success, false)
  })

  it("updates an example and splits cited slugs", () => {
    const parsed = supportReplyExampleUpdateSchema.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      customer_excerpt: "  Where is my board?  ",
      staff_reply: "  It shipped yesterday.  ",
      rating: "edited",
      kind: "",
      cited_help_slugs: "shipping-times, shipping-times\nprotection-claims",
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.customer_excerpt, "Where is my board?")
    assert.equal(parsed.data.staff_reply, "It shipped yesterday.")
    assert.equal(parsed.data.kind, null)
    assert.deepEqual(parsed.data.cited_help_slugs, ["shipping-times", "protection-claims"])
  })

  it("rejects an empty staff reply", () => {
    const parsed = supportReplyExampleUpdateSchema.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      customer_excerpt: "Hello",
      staff_reply: "   ",
      rating: "accepted",
      kind: "general",
      cited_help_slugs: [],
    })
    assert.equal(parsed.success, false)
  })

  it("requires a uuid to delete", () => {
    assert.equal(supportReplyExampleDeleteSchema.safeParse({ id: "nope" }).success, false)
    assert.equal(
      supportReplyExampleDeleteSchema.safeParse({
        id: "11111111-1111-4111-8111-111111111111",
      }).success,
      true,
    )
  })
})
