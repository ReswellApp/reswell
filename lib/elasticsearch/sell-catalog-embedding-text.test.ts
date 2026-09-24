import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { sellCatalogEmbeddingText } from "./sell-catalog-embedding-text.ts"

describe("sellCatalogEmbeddingText", () => {
  it("embeds a model as brand plus model plus category", () => {
    assert.equal(
      sellCatalogEmbeddingText({
        kind: "model",
        title: "Channel Islands Twin Pin",
        search_blob: "Channel Islands Twin Pin",
        categories: ["surfboards"],
      }),
      "Channel Islands Twin Pin surfboards",
    )
  })

  it("keeps a description that is not already the title", () => {
    assert.equal(
      sellCatalogEmbeddingText({
        kind: "brand",
        title: "Lost",
        search_blob: "Lost Mayhem surfboards",
        categories: ["surfboards"],
      }),
      "Lost surfboards brand. Lost Mayhem surfboards",
    )
  })
})
