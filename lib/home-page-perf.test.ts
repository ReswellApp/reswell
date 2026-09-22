import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

describe("homepage performance constraints", () => {
  it("does not run auth, favorites, or admin probes on the RSC path", () => {
    const src = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8")
    assert.doesNotMatch(src, /from\s+["']@\/lib\/supabase\/server["']/)
    assert.doesNotMatch(src, /\.from\(\s*["']favorites["']/)
    assert.doesNotMatch(src, /\.from\(\s*["']profiles["']/)
    assert.match(src, /HomeViewerProvider/)
    assert.match(src, /HomeHeroPrimaryCta/)
    assert.match(src, /getCachedHomeRecentlyListedGridCatalog/)
    assert.doesNotMatch(src, /Promise\.all/)
    assert.match(src, /HomeBelowFold/)
  })

  it("streams homepage rails below the recently listed grid", () => {
    const src = readFileSync(
      new URL("../components/features/home/home-below-fold.tsx", import.meta.url),
      "utf8",
    )
    assert.match(src, /Suspense/)
    assert.match(src, /getCachedHomeRecentlyAddedFinsCatalog/)
    assert.match(src, /getCachedHomeTrendingBrandsCatalog/)
    assert.match(src, /getCachedHomeRecentlyAddedSurfboardsCatalog/)
    assert.match(src, /getCachedHomeRecentlySoldCatalog/)
    assert.match(src, /getCachedHomeStableCatalog/)
  })

  it("keeps the hero LCP image high quality, prioritized, and full-bleed", () => {
    const src = readFileSync(new URL("../components/hero-backdrop.tsx", import.meta.url), "utf8")
    assert.match(src, /quality=\{90\}/)
    assert.match(src, /sizes="100vw"/)
    assert.match(src, /priority/)
    assert.match(src, /hero-backdrop-tahiti/)
  })
})
