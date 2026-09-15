import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isPeerSimilarFacetColumn,
  isPeerSimilarSection,
  normalizePeerSimilarFacetValue,
  peerSimilarPriceRange,
  peerSimilarPriceUsd,
  PEER_SIMILAR_PRICE_BANDS,
} from "./listing-detail-similar-peer.ts"

describe("peer similar PDP query helpers", () => {
  it("allows the peer marketplace sections that share the surfboard /l layout", () => {
    assert.equal(isPeerSimilarSection("fins"), true)
    assert.equal(isPeerSimilarSection("traction"), true)
    assert.equal(isPeerSimilarSection("wetsuits"), true)
    assert.equal(isPeerSimilarSection("apparel"), true)
    assert.equal(isPeerSimilarSection("magazines"), true)
    assert.equal(isPeerSimilarSection("boardbags"), true)
    assert.equal(isPeerSimilarSection("leashes"), true)
    assert.equal(isPeerSimilarSection("surfpacks"), true)
    assert.equal(isPeerSimilarSection("surfboards"), false)
    assert.equal(isPeerSimilarSection("accessories"), false)
  })

  it("whitelists facet columns used for similar matching", () => {
    assert.equal(isPeerSimilarFacetColumn("fin_system"), true)
    assert.equal(isPeerSimilarFacetColumn("traction_size"), true)
    assert.equal(isPeerSimilarFacetColumn("wetsuit_size"), true)
    assert.equal(isPeerSimilarFacetColumn("apparel_kind"), true)
    assert.equal(isPeerSimilarFacetColumn("magazine_year"), true)
    assert.equal(isPeerSimilarFacetColumn("boardbag_size"), true)
    assert.equal(isPeerSimilarFacetColumn("leash_size"), true)
    assert.equal(isPeerSimilarFacetColumn("surfpack_size"), true)
    assert.equal(isPeerSimilarFacetColumn("board_type"), false)
    assert.equal(isPeerSimilarFacetColumn("user_id"), false)
  })

  it("rejects non-positive prices so we can fall back to recent inventory", () => {
    assert.equal(peerSimilarPriceUsd(120), 120)
    assert.equal(peerSimilarPriceUsd(0), 0)
    assert.equal(peerSimilarPriceUsd(-8), 0)
    assert.equal(peerSimilarPriceUsd(Number.NaN), 0)
  })

  it("widens price bands the same way surfboard similar listings do", () => {
    assert.deepEqual(peerSimilarPriceRange(100, PEER_SIMILAR_PRICE_BANDS[0]), {
      low: 72,
      high: 128,
    })
    assert.deepEqual(peerSimilarPriceRange(100, PEER_SIMILAR_PRICE_BANDS[2]), {
      low: 45,
      high: 165,
    })
  })

  it("normalizes facet values and drops blanks", () => {
    assert.equal(normalizePeerSimilarFacetValue(" futures "), "futures")
    assert.equal(normalizePeerSimilarFacetValue(1984), 1984)
    assert.equal(normalizePeerSimilarFacetValue("  "), null)
    assert.equal(normalizePeerSimilarFacetValue(null), null)
  })
})
