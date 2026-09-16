import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  SUPPORT_REPLY_EXAMPLE_PAGE_SIZE,
  SUPPORT_REPLY_EXAMPLE_SEARCH_MAX,
  normalizeSupportReplyDraftRating,
  parseSupportReplyExampleListParams,
  supportReplyDraftCaseIdSchema,
  supportReplyExampleDeleteSchema,
  supportReplyExampleListSchema,
  supportReplyExampleUpdateSchema,
  supportReplyRatingForSentBody,
  supportReplyRootPromptSchema,
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

  it("keeps valid filters when one query param is invalid", () => {
    const parsed = parseSupportReplyExampleListParams({
      rating: "accepted",
      kind: "not-a-kind",
      q: "tracking",
      page: "nope",
    })
    assert.equal(parsed.rating, "very_good")
    assert.equal(parsed.kind, undefined)
    assert.equal(parsed.q, "tracking")
    assert.equal(parsed.page, undefined)
  })

  it("caps a long search without dropping rating or kind", () => {
    const q = `${"refund ".repeat(40)}end`
    const parsed = parseSupportReplyExampleListParams({
      rating: "edited",
      kind: "order_question",
      q,
    })
    assert.equal(parsed.rating, "okay")
    assert.equal(parsed.kind, "order_question")
    assert.equal(parsed.q?.length, SUPPORT_REPLY_EXAMPLE_SEARCH_MAX)
    assert.ok(parsed.q?.startsWith("refund"))
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
    assert.equal(parsed.data.rating, "okay")
    assert.deepEqual(parsed.data.cited_help_slugs, ["shipping-times", "protection-claims"])
  })

  it("maps the old accepted/edited/rejected labels onto quality ratings", () => {
    assert.equal(normalizeSupportReplyDraftRating("accepted"), "very_good")
    assert.equal(normalizeSupportReplyDraftRating("edited"), "okay")
    assert.equal(normalizeSupportReplyDraftRating("rejected"), "bad")
    assert.equal(normalizeSupportReplyDraftRating("very_good"), "very_good")
  })

  it("rates an edited send as okay so later drafts learn the sent text", () => {
    assert.equal(supportReplyRatingForSentBody("Hi there.", "Hi there."), "very_good")
    assert.equal(supportReplyRatingForSentBody("Hi there.", "Hi there — tracking is live."), "okay")
    assert.equal(supportReplyRatingForSentBody(null, "Wrote this from scratch."), "very_good")
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

  it("accepts a peek-only read that must not force a rewrite", () => {
    const parsed = supportReplyDraftCaseIdSchema.safeParse({
      case_id: "11111111-1111-4111-8111-111111111111",
      peek: true,
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.peek, true)
    assert.equal(parsed.data.force, undefined)
  })

  it("accepts an optional rewrite instruction on regenerate", () => {
    const parsed = supportReplyDraftCaseIdSchema.safeParse({
      case_id: "11111111-1111-4111-8111-111111111111",
      force: true,
      rewrite_instruction: "  Make it shorter  ",
      current_draft: "  Hi there  ",
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.rewrite_instruction, "Make it shorter")
    assert.equal(parsed.data.current_draft, "Hi there")
  })

  it("requires a non-empty root prompt", () => {
    assert.equal(supportReplyRootPromptSchema.safeParse({ body: "   " }).success, false)
    const parsed = supportReplyRootPromptSchema.safeParse({
      body: "  Be kind and specific.  ",
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.body, "Be kind and specific.")
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
