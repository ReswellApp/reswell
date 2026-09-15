import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  META_CATALOG_DAILY_ROTATION_BUCKETS,
  META_CATALOG_DAILY_ROTATION_PER_BUCKET,
  metaCatalogDailyRotationPoolSize,
} from "./daily-rotation-feed.ts"

describe("daily rotation catalog buckets", () => {
  it("covers six buckets of five", () => {
    assert.equal(META_CATALOG_DAILY_ROTATION_BUCKETS.length, 6)
    assert.equal(META_CATALOG_DAILY_ROTATION_PER_BUCKET, 5)
    assert.equal(
      META_CATALOG_DAILY_ROTATION_BUCKETS.filter((bucket) => bucket.haydenShopOnly).length,
      1,
    )
  })

  it("defaults the candidate pool size", () => {
    assert.equal(metaCatalogDailyRotationPoolSize(), 250)
  })
})
