import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  matchBrandFromLabel,
  matchBrandFromTitle,
  matchModelFromLabel,
  matchModelFromTitle,
  type BrandMatchRow,
  type ModelMatchRow,
} from "./listing-brand-model-match.ts"

const brands: BrandMatchRow[] = [
  { id: "ci", name: "Channel Islands", slug: "channel-islands-surfboards" },
  { id: "lost", name: "Lost Surfboards", slug: "lost-surfboards" },
  { id: "chris", name: "Chris Christenson", slug: "chris-christenson" },
  { id: "album", name: "Album Surf", slug: "album-surf" },
]

const lostModels: ModelMatchRow[] = [
  { id: "rnf", brand_id: "lost", name: "RNF" },
  { id: "round", brand_id: "lost", name: "Round Nose Fish" },
]

describe("matchBrandFromTitle", () => {
  it("matches a whole-word brand in the title", () => {
    const hit = matchBrandFromTitle("6'0 Lost Surfboards RNF", brands)
    assert.equal(hit?.id, "lost")
  })

  it("prefers the longer brand name", () => {
    const extra: BrandMatchRow[] = [
      ...brands,
      { id: "channel", name: "Channel", slug: "channel" },
    ]
    const hit = matchBrandFromTitle("Channel Islands Twin Pin", extra)
    assert.equal(hit?.id, "ci")
  })

  it("does not match a generic token overlap", () => {
    const hit = matchBrandFromTitle("6'0 used surfboard", brands)
    assert.equal(hit, null)
  })
})

describe("matchBrandFromLabel", () => {
  it("matches an exact directory name", () => {
    const hit = matchBrandFromLabel("Channel Islands", brands)
    assert.equal(hit?.id, "ci")
  })

  it("matches a unique prefix label like Lost → Lost Surfboards", () => {
    const hit = matchBrandFromLabel("Lost", brands)
    assert.equal(hit?.id, "lost")
  })

  it("returns null when several brands share the token", () => {
    const crowded: BrandMatchRow[] = [
      ...brands,
      { id: "lost-again", name: "Lost Again", slug: "lost-again" },
    ]
    assert.equal(matchBrandFromLabel("Lost", crowded), null)
  })

  it("does not invent a match from a short token", () => {
    assert.equal(matchBrandFromLabel("CI", brands), null)
  })
})

describe("matchModelFromTitle / matchModelFromLabel", () => {
  it("matches the longest model phrase in the title", () => {
    const hit = matchModelFromTitle("Lost Round Nose Fish 5'8", lostModels)
    assert.equal(hit?.id, "round")
  })

  it("matches an exact seller model label", () => {
    assert.equal(matchModelFromLabel("rnf", lostModels)?.id, "rnf")
  })

  it("does not fuzzy-match a different model", () => {
    assert.equal(matchModelFromLabel("RNF Retro", lostModels), null)
  })
})
