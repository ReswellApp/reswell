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

  it("keeps the hero LCP image at quality 85–90 with a capped sizes hint", () => {
    const src = readFileSync(new URL("../components/hero-backdrop.tsx", import.meta.url), "utf8")
    assert.match(src, /quality=\{8[5-9]\}|quality=\{90\}/)
    assert.match(src, /sizes="\(max-width: 1023px\) 100vw, 1440px"/)
    assert.match(src, /priority/)
    assert.doesNotMatch(src, /quality=\{95\}/)
    assert.doesNotMatch(src, /quality=\{75\}/)
    assert.doesNotMatch(src, /sizes="100vw"/)
  })

  it("serves homepage listing tiles at pdp density instead of 640px thumbs", () => {
    const src = readFileSync(
      new URL("../components/features/home/home-viewer-hydration.tsx", import.meta.url),
      "utf8",
    )
    assert.match(src, /imageDensity="pdp"/)
  })
})
