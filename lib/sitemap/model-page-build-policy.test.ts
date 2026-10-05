import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import { buildModelPageSitemapEntries } from "./model-page-entries.ts"

const modelPageSource = readFileSync(
  new URL("../../app/[brand]/[model]/page.tsx", import.meta.url),
  "utf8",
)
const sitemapBuilderSource = readFileSync(
  new URL("./build-sitemap-entries.ts", import.meta.url),
  "utf8",
)

describe("model page build policy", () => {
  it("prebuilds no catalog models and allows unknown paths to use hourly ISR", () => {
    assert.match(modelPageSource, /export const revalidate = 3600/)
    assert.match(modelPageSource, /export const dynamicParams = true/)
    assert.match(
      modelPageSource,
      /export function generateStaticParams[\s\S]*?\n  return \[\]\n\}/,
    )
    assert.doesNotMatch(modelPageSource, /fetchBrandModelSitemapEntries/)
  })

  it("renders the catalog shell without a session cookie read", () => {
    assert.doesNotMatch(modelPageSource, /createClient\(/)
    assert.doesNotMatch(modelPageSource, /auth\.getUser\(/)
    assert.doesNotMatch(modelPageSource, /from ["']next\/headers["']/)
    assert.match(modelPageSource, /getDb\(\{ consistency: "eventual" \}\)/)
  })

  it("keeps every catalog model in the pages sitemap", () => {
    const rows = Array.from({ length: 4000 }, (_, index) => ({
      brandSlug: `brand-${Math.floor(index / 20)}`,
      modelSlug: `model-${index}`,
    }))
    const lastModified = new Date("2026-09-30T00:00:00.000Z")
    const entries = buildModelPageSitemapEntries(
      rows,
      "https://www.reswell.app",
      lastModified,
    )

    assert.equal(entries.length, rows.length)
    assert.equal(entries[0]?.url, "https://www.reswell.app/brand-0/model-0")
    assert.equal(
      entries.at(-1)?.url,
      "https://www.reswell.app/brand-199/model-3999",
    )
    assert.ok(entries.every((entry) => entry.lastModified === lastModified))
    assert.match(
      sitemapBuilderSource,
      /buildModelPageSitemapEntries\(modelRows, BASE, now\)/,
    )
  })
})
