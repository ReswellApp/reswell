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

  it("forwards anonymousPublicView into every section PDP so cookies() cannot dynamize /l", () => {
    const pages = [
      "components/surfboard-listing-detail-page.tsx",
      "components/fins-listing-detail-page.tsx",
      "components/wetsuits-listing-detail-page.tsx",
      "components/boardbags-listing-detail-page.tsx",
      "components/surfpacks-listing-detail-page.tsx",
      "components/leashes-listing-detail-page.tsx",
      "components/apparel-listing-detail-page.tsx",
      "components/accessories-listing-detail-page.tsx",
      "components/magazines-listing-detail-page.tsx",
      "components/traction-listing-detail-page.tsx",
    ]
    for (const page of pages) {
      const src = readRepo(page)
      assert.match(src, /anonymousPublicView,/, `${page} must forward anonymousPublicView`)
    }

    const load = readRepo("lib/listing-detail-page-load.ts")
    assert.match(load, /if \(anonymousPublicView && prefetchedListing\)/)
    assert.match(load, /createAnonSupabaseClient/)

    const strips = readRepo("components/features/listings/surfboard-listing-pdp-catalog-strips.tsx")
    assert.match(strips, /viewerUser \?\? null/)
    assert.match(strips, /user \? \(await getCachedRequestSession\(\)\)\.supabase : null/)
  })
})
