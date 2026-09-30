import assert from "node:assert/strict"
import { describe, it } from "node:test"
// @ts-expect-error Node's strip-types runner requires the source extension.
import { resolveNearbyBrowseFallbackRows, type BrowseFallbackSourceRow } from "./boards-browse-fallback.ts"

function row(
  id: string,
  distance: number,
  overrides: Partial<BrowseFallbackSourceRow> = {},
): BrowseFallbackSourceRow & { _distance: number } {
  return {
    id,
    slug: id,
    user_id: "seller",
    title: `Board ${id}`,
    price: 500,
    status: "active",
    primary_image_url: `https://cdn.example/${id}.webp`,
    primary_thumbnail_url: `https://cdn.example/${id}-thumb.webp`,
    _distance: distance,
    ...overrides,
  }
}

describe("resolveNearbyBrowseFallbackRows", () => {
  it("preserves keyword matches before relaxing nearby", () => {
    const resolved = resolveNearbyBrowseFallbackRows(
      [
        row("near-other", 5),
        row("near-match", 40, { brand: "Album" }),
        row("wide-match", 300, { title: "Album Twinsman" }),
      ],
      "album",
    )

    assert.equal(resolved.kind, "near-keyword")
    assert.deepEqual(resolved.rows.map((item) => item.id), ["near-match"])
  })

  it("relaxes the keyword within 100 miles before widening", () => {
    const resolved = resolveNearbyBrowseFallbackRows(
      [row("near-other", 20), row("wide-match", 300, { tail_shape: "swallow" })],
      "swallow",
    )

    assert.equal(resolved.kind, "near-relaxed")
    assert.deepEqual(resolved.rows.map((item) => item.id), ["near-other"])
  })

  it("maps denormalized gallery data and strips fallback-only or private fields", () => {
    const source = row("mapped", 10, {
      description: "Search-only copy",
      tile_gallery_images: [
        { url: "https://cdn.example/mapped.webp", thumbnail_url: "https://cdn.example/mapped-t.webp" },
        { url: "https://cdn.example/mapped-2.webp" },
      ],
    }) as BrowseFallbackSourceRow & {
      _distance: number
      seller_purchase_price_usd: number
      guest_token_hash: string
    }
    source.seller_purchase_price_usd = 125
    source.guest_token_hash = "secret"

    const [mapped] = resolveNearbyBrowseFallbackRows([source], "").rows

    assert.equal(mapped?.listing_images?.length, 2)
    assert.equal(mapped?.listing_images?.[0]?.thumbnail_url, "https://cdn.example/mapped-t.webp")
    assert.equal("description" in (mapped ?? {}), false)
    assert.equal("seller_purchase_price_usd" in (mapped ?? {}), false)
    assert.equal("guest_token_hash" in (mapped ?? {}), false)
  })
})
