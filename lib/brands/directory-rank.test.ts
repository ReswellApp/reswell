import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { compareDirectoryBrands, sortDirectoryBrands } from "@/lib/brands/directory-rank"

function brand(
  id: string,
  name: string,
  model_count: number,
  logo_url: string | null = null,
) {
  return { id, name, model_count, logo_url }
}

describe("compareDirectoryBrands", () => {
  const counts = new Map<string, number>([
    ["ci", 39],
    ["lost", 13],
    ["empty-listing", 4],
    ["album", 9],
  ])

  it("puts brands with models ahead of listing-only brands", () => {
    const withModels = brand("indie", "1-DA Shapes", 8)
    const listingsOnly = brand("empty-listing", "TERRAMAR SURF", 0)
    assert.ok(compareDirectoryBrands(withModels, listingsOnly, counts) < 0)
  })

  it("puts attached listings ahead of zero-listing catalog brands", () => {
    const popular = brand("ci", "Channel Islands Surfboards", 20, "/logo.png")
    const quiet = brand("quiet", "Quiet Shaper", 20, "/logo.png")
    assert.ok(compareDirectoryBrands(popular, quiet, counts) < 0)
  })

  it("ranks more attached listings above fewer", () => {
    const ci = brand("ci", "Channel Islands Surfboards", 40)
    const lost = brand("lost", "Lost Surfboards", 40)
    assert.ok(compareDirectoryBrands(ci, lost, counts) < 0)
  })

  it("ranks more models when listing counts match", () => {
    const more = brand("a", "Album Surf", 30)
    const fewer = brand("b", "Bing Surfboards", 4)
    const even = { a: 1, b: 1 }
    assert.ok(compareDirectoryBrands(more, fewer, even) < 0)
  })

  it("prefers a logo over initials when the rest is equal", () => {
    const withLogo = brand("a", "Zed", 3, "https://cdn.example/z.png")
    const noLogo = brand("b", "Aye", 3, null)
    assert.ok(compareDirectoryBrands(withLogo, noLogo, {}) < 0)
  })
})

describe("sortDirectoryBrands", () => {
  it("orders a mixed directory: models+listings, models, listings, then the rest", () => {
    const rows = [
      brand("zzz", "Zed Empty", 0),
      brand("listings", "Listing Only", 0),
      brand("quiet", "Quiet Models", 12),
      brand("ci", "Channel Islands", 40, "/ci.png"),
      brand("album", "Album Surf", 24),
    ]
    const counts = new Map<string, number>([
      ["ci", 39],
      ["album", 9],
      ["listings", 24],
    ])
    const sorted = sortDirectoryBrands(rows, counts).map((row) => row.id)
    assert.deepEqual(sorted, ["ci", "album", "quiet", "listings", "zzz"])
  })
})
