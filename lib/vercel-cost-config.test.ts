import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

function readRepo(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8")
}

describe("Vercel cost configuration", () => {
  it("pins Fluid compute to one region and skips docs-only preview builds", () => {
    const config = JSON.parse(readRepo("vercel.json")) as {
      regions?: string[]
      ignoreCommand?: string
      headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
      crons?: Array<{ path: string; schedule: string }>
    }
    assert.deepEqual(config.regions, ["sfo1"])
    assert.equal(config.ignoreCommand, "bash scripts/vercel-ignore-build.sh")
    const ignore = readRepo("scripts/vercel-ignore-build.sh")
    assert.match(ignore, /VERCEL_GIT_PREVIOUS_SHA/)
    assert.match(ignore, /git diff --quiet "\$PREV" HEAD/)
    assert.match(ignore, /\[ "\$PREV_SHA" = "\$HEAD_SHA" \]/)

    const media = config.headers?.find((entry) => entry.source === "/media/(.*)")
    assert.ok(media)
    assert.ok(
      media.headers.some(
        (header) => header.key === "x-vercel-enable-rewrite-caching" && header.value === "1",
      ),
    )

    const cron = (path: string) => config.crons?.find((entry) => entry.path === path)?.schedule
    assert.equal(cron("/api/cron/shopify-sync"), "2,17,32,47 * * * *")
    assert.equal(cron("/api/cron/klaviyo-catalog-sync"), "6,36 * * * *")
    assert.equal(cron("/api/cron/support-case-backfill"), "14 * * * *")
    assert.equal(cron("/api/cron/notification-fanout"), "3-58/5 * * * *")
    assert.equal(cron("/api/cron/board-buy-sla"), "1-56/5 * * * *")
  })

  it("does not wrap listing photo bodies in unstable_cache", () => {
    const storage = readRepo("lib/cache/public-storage-object.ts")
    const variants = readRepo("lib/media/listing-tile-variant-resize.ts")
    const proxy = readRepo("proxy.ts")
    const posthog = readRepo("lib/client/init-posthog-client.ts")
    assert.match(storage, /usesPublicStorageDataCache/)
    assert.match(storage, /brand-assets/)
    assert.match(storage, /cache: "no-store"/)
    assert.doesNotMatch(variants, /unstable_cache\(/)
    assert.match(proxy, /ingest\//)
    assert.match(posthog, /api_host: posthogHost/)
    assert.doesNotMatch(posthog, /api_host:\s*["']\/ingest["']/)
  })

  it("does not load Vercel Web Analytics", () => {
    const inner = readRepo("components/deferred-marketing-runtime-inner.tsx")
    assert.doesNotMatch(inner, /@vercel\/analytics/)
  })
})
