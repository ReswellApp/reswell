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
  })

  it("keeps the hero LCP image high quality, prioritized, and full-bleed", () => {
    const src = readFileSync(new URL("../components/hero-backdrop.tsx", import.meta.url), "utf8")
    assert.match(src, /quality=\{90\}/)
    assert.match(src, /sizes="100vw"/)
    assert.match(src, /priority/)
    assert.match(src, /hero-backdrop-tahiti/)
  })
})
