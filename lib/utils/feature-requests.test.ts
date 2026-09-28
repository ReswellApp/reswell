import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createFeatureRequestSchema } from "../validations/featureRequests.ts"
import {
  featureRequestAuthorLabel,
  featureRequestBoardHref,
  featureRequestCode,
  featureRequestCommentLabel,
  featureRequestExcerpt,
  featureRequestPath,
  formatFeatureRequestEstimate,
  parseFeatureRequestBoardQuery,
  parseFeatureRequestNumberParam,
  parseFeatureRequestSearchNumber,
} from "./feature-requests.ts"

describe("feature request board query", () => {
  it("defaults to open ideas sorted by votes", () => {
    const query = parseFeatureRequestBoardQuery({})
    assert.deepEqual(query, { status: "open", sort: "top", kind: "all", q: "", page: 1 })
    assert.equal(featureRequestBoardHref(query), "/feature-requests")
  })

  it("keeps valid filters and drops unknown ones", () => {
    const query = parseFeatureRequestBoardQuery({
      status: "shipped",
      sort: "comments",
      kind: "bug",
      q: "  dark mode  ",
      page: "3",
    })
    assert.equal(query.status, "shipped")
    assert.equal(query.sort, "comments")
    assert.equal(query.kind, "bug")
    assert.equal(query.q, "dark mode")
    assert.equal(query.page, 3)
    assert.equal(
      featureRequestBoardHref(query),
      "/feature-requests?status=shipped&sort=comments&kind=bug&q=dark+mode&page=3",
    )
  })

  it("falls back when the query string is junk", () => {
    const query = parseFeatureRequestBoardQuery({
      status: "nope",
      sort: ["nope"],
      kind: "idea",
      page: "0",
    })
    assert.equal(query.status, "open")
    assert.equal(query.sort, "top")
    assert.equal(query.kind, "all")
    assert.equal(query.page, 1)
  })
})

describe("feature request numbers", () => {
  it("parses public ids", () => {
    assert.equal(parseFeatureRequestNumberParam("fr-100"), 100)
    assert.equal(parseFeatureRequestNumberParam("FR-42"), 42)
    assert.equal(parseFeatureRequestNumberParam("100"), 100)
    assert.equal(parseFeatureRequestNumberParam("changelog"), null)
    assert.equal(parseFeatureRequestSearchNumber("FR-389"), 389)
    assert.equal(parseFeatureRequestSearchNumber("shipping"), null)
    assert.equal(featureRequestCode(389), "FR-389")
    assert.equal(featureRequestPath(389), "/feature-requests/fr-389")
  })
})

describe("feature request display", () => {
  it("formats excerpts, authors, comments, and estimates", () => {
    assert.equal(featureRequestExcerpt("line\n\nbreak"), "line break")
    assert.equal(featureRequestExcerpt("a".repeat(20), 10), `${"a".repeat(9)}…`)
    assert.equal(featureRequestAuthorLabel("rebecca"), "@rebecca")
    assert.equal(featureRequestAuthorLabel("Esther Fung"), "Esther Fung")
    assert.equal(featureRequestAuthorLabel(null), "Member")
    assert.equal(featureRequestCommentLabel(1), "1 comment")
    assert.equal(featureRequestCommentLabel(16), "16 comments")
    assert.equal(formatFeatureRequestEstimate("September 2026"), "Est. September 2026")
    assert.equal(formatFeatureRequestEstimate("Est. October 2026"), "Est. October 2026")
    assert.equal(formatFeatureRequestEstimate("  "), null)
  })
})

describe("create feature request schema", () => {
  it("accepts a bug report with tags", () => {
    const parsed = createFeatureRequestSchema.safeParse({
      kind: "bug",
      title: "Photos crop too tight",
      body: "Listing photos are cut off and I cannot zoom out to show the whole board.",
      tags: ["selling", "app"],
    })
    assert.equal(parsed.success, true)
  })

  it("rejects a title that is too short", () => {
    const parsed = createFeatureRequestSchema.safeParse({
      kind: "feature",
      title: "Hi",
      body: "This needs more of a title before it can go on the board.",
      tags: [],
    })
    assert.equal(parsed.success, false)
  })
})
