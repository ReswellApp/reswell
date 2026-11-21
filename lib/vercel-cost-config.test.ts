import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

function readRepo(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8")
}

describe("Vercel cost configuration", () => {
  it("pins Fluid compute to a single region next to CA traffic", () => {
    const config = JSON.parse(readRepo("vercel.json")) as {
      regions?: string[]
      ignoreCommand?: string
      headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
    }
    assert.deepEqual(config.regions, ["sfo1"])
    assert.equal(config.ignoreCommand, "bash scripts/vercel-ignore-build.sh")
    const ignore = readRepo("scripts/vercel-ignore-build.sh")
    assert.match(ignore, /VERCEL_GIT_PREVIOUS_SHA/)
    assert.match(ignore, /git diff --quiet "\$PREV" HEAD/)
    assert.doesNotMatch(ignore, /git diff --quiet HEAD/)

    const media = config.headers?.find((entry) => entry.source === "/media/(.*)")
    assert.ok(media)
    assert.ok(
      media.headers.some(
        (header) => header.key === "x-vercel-enable-rewrite-caching" && header.value === "1",
      ),
    )
  })

  it("does not wrap listing photo bodies in unstable_cache", () => {
    const storage = readRepo("lib/cache/public-storage-object.ts")
    const variants = readRepo("lib/media/listing-tile-variant-resize.ts")
    assert.match(storage, /usesPublicStorageDataCache/)
    assert.match(storage, /brand-assets/)
    assert.match(storage, /cache: "no-store"/)
    assert.doesNotMatch(variants, /unstable_cache\(/)
  })
})
