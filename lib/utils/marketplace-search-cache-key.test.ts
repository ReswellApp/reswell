import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { marketplaceSearchCacheParts } from "./marketplace-search-cache-key.ts"

describe("marketplaceSearchCacheParts", () => {
  it("trims query, brand, and category so cache keys collapse whitespace", () => {
    assert.deepEqual(
      marketplaceSearchCacheParts("  Lost  ", " lost-surfboards ", " shortboard "),
      {
        rawQuery: "Lost",
        brandSlug: "lost-surfboards",
        categorySlug: "shortboard",
      },
    )
  })
})
