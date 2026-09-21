import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isAutoPriceDropScheduleSchemaMissing } from "./db/listingAutoPriceDrop.ts"
import {
  listingAutoPriceDropDue,
  omitClientAutoPriceDropSchedule,
  planListingAutoPriceDrop,
} from "./listing-auto-price-drop.ts"

const now = new Date("2026-09-16T20:00:00.000Z")

describe("listingAutoPriceDropDue", () => {
  it("is due when active and the scheduled time has passed", () => {
    assert.equal(
      listingAutoPriceDropDue({
        status: "active",
        scheduledFor: "2026-09-16T19:59:00.000Z",
        referenceTime: now,
      }),
      true,
    )
  })

  it("is not due for drafts or a future schedule", () => {
    assert.equal(
      listingAutoPriceDropDue({
        status: "draft",
        scheduledFor: "2026-09-16T19:59:00.000Z",
        referenceTime: now,
      }),
      false,
    )
    assert.equal(
      listingAutoPriceDropDue({
        status: "active",
        scheduledFor: "2026-09-16T20:00:01.000Z",
        referenceTime: now,
      }),
      false,
    )
  })
})

describe("planListingAutoPriceDrop", () => {
  it("drops to the floor and keeps the previous list price as markdown", () => {
    assert.deepEqual(
      planListingAutoPriceDrop({
        status: "active",
        priceUsd: 800,
        compareAtPriceUsd: null,
        floorUsd: 650,
        scheduledFor: "2026-09-02T20:00:00.000Z",
        referenceTime: now,
      }),
      {
        action: "drop",
        nextPriceUsd: 650,
        compareAtPriceUsd: 800,
      },
    )
  })

  it("keeps a higher existing compare-at when dropping again", () => {
    assert.deepEqual(
      planListingAutoPriceDrop({
        status: "active",
        priceUsd: 700,
        compareAtPriceUsd: 900,
        floorUsd: 600,
        scheduledFor: "2026-09-02T20:00:00.000Z",
        referenceTime: now,
      }),
      {
        action: "drop",
        nextPriceUsd: 600,
        compareAtPriceUsd: 900,
      },
    )
  })

  it("clears a floor that is no longer below list price", () => {
    assert.deepEqual(
      planListingAutoPriceDrop({
        status: "active",
        priceUsd: 500,
        compareAtPriceUsd: null,
        floorUsd: 500,
        scheduledFor: "2026-09-02T20:00:00.000Z",
        referenceTime: now,
      }),
      { action: "clear" },
    )
  })

  it("skips listings that are not yet due", () => {
    assert.deepEqual(
      planListingAutoPriceDrop({
        status: "active",
        priceUsd: 800,
        compareAtPriceUsd: null,
        floorUsd: 650,
        scheduledFor: "2026-09-30T20:00:00.000Z",
        referenceTime: now,
      }),
      { action: "skip" },
    )
  })
})

describe("isAutoPriceDropScheduleSchemaMissing", () => {
  it("matches the production cron error", () => {
    assert.equal(
      isAutoPriceDropScheduleSchemaMissing(
        "column listings.auto_price_drop_scheduled_for does not exist",
      ),
      true,
    )
    assert.equal(
      isAutoPriceDropScheduleSchemaMissing({
        code: "PGRST204",
        message:
          "Could not find the 'auto_price_drop_scheduled_for' column of 'listings' in the schema cache",
      }),
      true,
    )
    assert.equal(
      isAutoPriceDropScheduleSchemaMissing("column listings.price does not exist"),
      false,
    )
  })
})

describe("omitClientAutoPriceDropSchedule", () => {
  it("drops a client-supplied due date", () => {
    assert.deepEqual(
      omitClientAutoPriceDropSchedule({
        auto_price_drop_floor: 650,
        auto_price_drop_scheduled_for: "2026-01-01T00:00:00.000Z",
        price: 800,
      }),
      { auto_price_drop_floor: 650, price: 800 },
    )
  })
})
