import type { ModelSitemapEntry } from "../db/sitemap-models.ts"
import type { SitemapUrlEntry } from "./types.ts"

export function buildModelPageSitemapEntries(
  rows: ModelSitemapEntry[],
  base: string,
  lastModified: Date,
): SitemapUrlEntry[] {
  return rows.map((row) => ({
    url: `${base}/${row.brandSlug}/${row.modelSlug}`,
    lastModified,
    changeFrequency: "daily",
    priority: 0.65,
  }))
}
