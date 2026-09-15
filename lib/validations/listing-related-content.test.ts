import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  adminAddRelatedContentBodySchema,
  adminRelatedContentSearchQuerySchema,
  adminReorderRelatedContentBodySchema,
} from "./listing-related-content.ts"

const listingId = "11111111-1111-4111-8111-111111111111"
const blogId = "22222222-2222-4222-8222-222222222222"

describe("adminAddRelatedContentBodySchema", () => {
  it("accepts a blog attachment", () => {
    const parsed = adminAddRelatedContentBodySchema.parse({
      kind: "blog",
      blog_post_id: blogId,
    })
    assert.equal(parsed.kind, "blog")
    assert.equal(parsed.blog_post_id, blogId)
  })

  it("accepts a listing attachment", () => {
    const parsed = adminAddRelatedContentBodySchema.parse({
      kind: "listing",
      related_listing_id: listingId,
    })
    assert.equal(parsed.kind, "listing")
    assert.equal(parsed.related_listing_id, listingId)
  })

  it("rejects a blog row without a post id", () => {
    const parsed = adminAddRelatedContentBodySchema.safeParse({ kind: "blog" })
    assert.equal(parsed.success, false)
  })

  it("rejects mixed targets", () => {
    const parsed = adminAddRelatedContentBodySchema.safeParse({
      kind: "blog",
      blog_post_id: blogId,
      related_listing_id: listingId,
    })
    assert.equal(parsed.success, false)
  })
})

describe("adminRelatedContentSearchQuerySchema", () => {
  it("defaults an empty query", () => {
    const parsed = adminRelatedContentSearchQuerySchema.parse({ type: "blog" })
    assert.equal(parsed.q, "")
    assert.equal(parsed.limit, 20)
  })
})

describe("adminReorderRelatedContentBodySchema", () => {
  it("requires at least one row id", () => {
    const parsed = adminReorderRelatedContentBodySchema.safeParse({ ordered_row_ids: [] })
    assert.equal(parsed.success, false)
  })
})
