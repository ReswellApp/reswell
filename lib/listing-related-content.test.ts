import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  firstBlogArticleImageUrl,
  firstBlogListingEmbedRef,
  isRelatedBlogVisibleOnPdp,
  isRelatedListingVisibleOnPdp,
  listingRelatedContentCacheTag,
  relatedContentKindLabel,
} from "./listing-related-content.ts"

describe("related content visibility", () => {
  it("shows published blogs and hides drafts", () => {
    assert.equal(isRelatedBlogVisibleOnPdp({ published: true }), true)
    assert.equal(isRelatedBlogVisibleOnPdp({ published: false }), false)
  })

  it("shows only active, site-visible listings", () => {
    assert.equal(isRelatedListingVisibleOnPdp({ status: "active", hidden_from_site: false }), true)
    assert.equal(isRelatedListingVisibleOnPdp({ status: "sold", hidden_from_site: false }), false)
    assert.equal(isRelatedListingVisibleOnPdp({ status: "active", hidden_from_site: true }), false)
  })

  it("labels kinds for the PDP strip", () => {
    assert.equal(relatedContentKindLabel("blog"), "blog")
    assert.equal(relatedContentKindLabel("listing"), "listing")
  })

  it("scopes the cache tag to a listing", () => {
    assert.equal(listingRelatedContentCacheTag(" abc "), "listing-related-content:abc")
  })

  it("uses the first real article photo, not a generated title card", () => {
    assert.equal(firstBlogArticleImageUrl([{ kind: "h2", url: null }]), null)
    assert.equal(
      firstBlogArticleImageUrl([
        { kind: "p" },
        { kind: "image", url: "https://images.example.com/board.jpg" },
      ]),
      "https://images.example.com/board.jpg",
    )
  })

  it("uses the first listing embed when the article has no cover photo", () => {
    assert.equal(firstBlogListingEmbedRef([{ kind: "image", url: "https://images.example.com/board.jpg" }]), null)
    assert.equal(
      firstBlogListingEmbedRef([
        { kind: "p" },
        { kind: "listing-image", ref: "lovemachine-zambal-surfboard-5-9-ryan-lovelace" },
        { kind: "listing", ref: "other-board" },
      ]),
      "lovemachine-zambal-surfboard-5-9-ryan-lovelace",
    )
  })
})
