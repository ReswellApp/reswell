import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { z } from "zod"
import {
  listingAcquisitionFieldShape,
  updateListingAcquisitionSchema,
} from "./listing-acquisition.ts"

const schema = z.object(listingAcquisitionFieldShape)

describe("listing acquisition fields", () => {
  it("accepts empty optional acquisition metadata", () => {
    assert.equal(schema.safeParse({}).success, true)
    assert.equal(
      schema.safeParse({
        sellerPurchasePrice: null,
        sellerPurchasedFrom: null,
        sellerPurchasedOn: null,
      }).success,
      true,
    )
  })

  it("accepts a valid cost basis, source, and calendar date", () => {
    const parsed = schema.safeParse({
      sellerPurchasePrice: 425.5,
      sellerPurchasedFrom: "Local surf shop",
      sellerPurchasedOn: "2026-09-30",
    })

    assert.equal(parsed.success, true)
  })

  it("rejects negative prices, invalid dates, and oversized sources", () => {
    assert.equal(schema.safeParse({ sellerPurchasePrice: -1 }).success, false)
    assert.equal(schema.safeParse({ sellerPurchasedOn: "09/30/2026" }).success, false)
    assert.equal(
      schema.safeParse({ sellerPurchasedFrom: "x".repeat(201) }).success,
      false,
    )
  })
})

describe("update listing acquisition input", () => {
  const listingId = "2cd9388f-8527-4218-83f3-233f21a42425"

  it("normalizes cleared fields to null", () => {
    const parsed = updateListingAcquisitionSchema.parse({
      listingId,
      purchasePrice: "",
      purchasedFrom: "  ",
      purchasedOn: "",
    })

    assert.deepEqual(parsed, {
      listingId,
      purchasePrice: null,
      purchasedFrom: null,
      purchasedOn: null,
    })
  })

  it("coerces a valid edited price and trims its source", () => {
    const parsed = updateListingAcquisitionSchema.parse({
      listingId,
      purchasePrice: "120.50",
      purchasedFrom: "  Local seller  ",
      purchasedOn: "2026-09-30",
    })

    assert.equal(parsed.purchasePrice, 120.5)
    assert.equal(parsed.purchasedFrom, "Local seller")
    assert.equal(parsed.purchasedOn, "2026-09-30")
  })
})
