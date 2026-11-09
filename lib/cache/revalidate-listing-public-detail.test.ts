import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { publicMarketplaceCdnCacheControl } from "../crawler/public-marketplace-paths.ts"
import { PUBLIC_MARKETPLACE_EDGE_CACHE_CONTROL } from "../crawler/public-marketplace-cache-policy.ts"

function readRepo(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8")
}

describe("listing detail revalidation", () => {
  it("expires the concrete /l URL instead of a /page tag that the dynamic route never sets", () => {
    const src = readRepo("lib/cache/revalidate-listing-public-detail.ts")
    assert.match(src, /revalidatePath\(trimmed\)/)
    assert.match(src, /expire:\s*0/)
    assert.doesNotMatch(src, /revalidatePath\([^)]*,\s*["']page["']\)/)
  })

  it("drops the listing shell before the save response, not in after()", () => {
    const ownedEdit = readRepo("app/api/listings/[id]/owned-edit/route.ts")
    const expireAt = ownedEdit.indexOf("expirePublicListingSurfacesAfterEdit(")
    const afterAt = ownedEdit.indexOf("after(() => {")
    assert.ok(expireAt > -1)
    assert.ok(afterAt > expireAt)

    const revalidateRoute = readRepo("app/api/listings/revalidate-mutation/route.ts")
    const routeExpireAt = revalidateRoute.indexOf("expirePublicListingSurfacesAfterEdit(")
    const routeAfterAt = revalidateRoute.indexOf("after(() => {")
    assert.ok(routeExpireAt > -1)
    assert.ok(routeAfterAt > routeExpireAt)
  })

  it("does not keep /l on the 24h edge stale-while-revalidate window", () => {
    assert.equal(publicMarketplaceCdnCacheControl("/l/lost-pisces", false), null)
    assert.equal(publicMarketplaceCdnCacheControl("/sold", false), null)
    assert.equal(
      publicMarketplaceCdnCacheControl("/boards", false),
      PUBLIC_MARKETPLACE_EDGE_CACHE_CONTROL,
    )
  })
})
