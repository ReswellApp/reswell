/**
 * Daily-rotating Meta catalog: 5 fins, 5 traction pads, 5 wetsuits, 5 apparel,
 * 5 magazines, and 5 Hayden Garfield shop surfboards.
 *
 * Selection is deterministic for a UTC 24h seed (same helper as `/boards`).
 * Prefer listings that were not in yesterday's set; reuse when inventory is thin.
 */

export const META_CATALOG_DAILY_ROTATION_PER_BUCKET = 5
export const META_CATALOG_DAILY_ROTATION_DEFAULT_POOL_SIZE = 250

export const META_CATALOG_DAILY_ROTATION_SECTIONS = [
  "fins",
  "traction",
  "wetsuits",
  "apparel",
  "magazines",
  "surfboards",
] as const

export type MetaCatalogDailyRotationSection =
  (typeof META_CATALOG_DAILY_ROTATION_SECTIONS)[number]

export const META_CATALOG_DAILY_ROTATION_BUCKETS = [
  { key: "fins", section: "fins", customLabel1: "Fins", haydenShopOnly: false },
  { key: "traction", section: "traction", customLabel1: "Traction", haydenShopOnly: false },
  { key: "wetsuits", section: "wetsuits", customLabel1: "Wetsuits", haydenShopOnly: false },
  { key: "apparel", section: "apparel", customLabel1: "Apparel", haydenShopOnly: false },
  { key: "magazines", section: "magazines", customLabel1: "Magazines", haydenShopOnly: false },
  {
    key: "hayden_shop_boards",
    section: "surfboards",
    customLabel1: "HaydenShop",
    haydenShopOnly: true,
  },
] as const

export type MetaCatalogDailyRotationBucket =
  (typeof META_CATALOG_DAILY_ROTATION_BUCKETS)[number]

export type MetaCatalogDailyRotationBucketKey = MetaCatalogDailyRotationBucket["key"]

export function metaCatalogDailyRotationPoolSize(): number {
  const raw = process.env.META_CATALOG_DAILY_ROTATION_POOL_SIZE?.trim()
  if (!raw) return META_CATALOG_DAILY_ROTATION_DEFAULT_POOL_SIZE
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < META_CATALOG_DAILY_ROTATION_PER_BUCKET) {
    return META_CATALOG_DAILY_ROTATION_DEFAULT_POOL_SIZE
  }
  return Math.min(parsed, 1_000)
}
