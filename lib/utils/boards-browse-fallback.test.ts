import assert from "node:assert/strict"
import { describe, it } from "node:test"
// @ts-expect-error Node's strip-types runner requires the source extension.
import { resolveNearbyBrowseFallbackCandidates } from "./boards-browse-fallback.ts"

function row(
  id: string,
  distanceMi: number,
): { id: string; distanceMi: number } {
  return { id, distanceMi }
}

describe("resolveNearbyBrowseFallbackCandidates", () => {
  it("preserves keyword matches before relaxing nearby", () => {
    const resolved = resolveNearbyBrowseFallbackCandidates(
      [row("near-other", 5), row("near-match", 40), row("wide-match", 300)],
      new Set(["near-match", "wide-match"]),
      true,
    )

    assert.equal(resolved.kind, "near-keyword")
    assert.deepEqual(resolved.ids, ["near-match"])
  })

  it("relaxes the keyword within 100 miles before widening", () => {
    const resolved = resolveNearbyBrowseFallbackCandidates(
      [row("near-other", 20), row("wide-match", 300)],
      new Set(["wide-match"]),
      true,
    )

    assert.equal(resolved.kind, "near-relaxed")
    assert.deepEqual(resolved.ids, ["near-other"])
  })

  it("keeps an older nearest keyword match beyond the former 180-newest window", () => {
    const newest = Array.from({ length: 180 }, (_, index) =>
      row(`new-${index}`, 200 + index),
    )
    const olderNearestMatch = row("older-nearest-match", 3)
    const resolved = resolveNearbyBrowseFallbackCandidates(
      [...newest, olderNearestMatch],
      new Set([olderNearestMatch.id]),
      true,
    )

    assert.equal(resolved.kind, "near-keyword")
    assert.equal(resolved.ids[0], olderNearestMatch.id)
  })
})
