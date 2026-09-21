import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  effectiveMinimumOfferAmount,
  minimumOfferAmountFromDb,
  minimumOfferAmountToDb,
} from "./offers-minimum-amount.ts"

describe("minimumOfferAmountToDb", () => {
  it("returns null when the optional field is missing so edit-publish does not throw", () => {
    assert.equal(minimumOfferAmountToDb(undefined), null)
    assert.equal(minimumOfferAmountToDb(null), null)
    assert.equal(minimumOfferAmountToDb(""), null)
    assert.equal(minimumOfferAmountToDb("   "), null)
  })

  it("parses dollar strings sellers type into the optional offer field", () => {
    assert.equal(minimumOfferAmountToDb("650"), 650)
    assert.equal(minimumOfferAmountToDb("$650.00"), 650)
    assert.equal(minimumOfferAmountToDb("  $1,200.00  "), 1200)
    assert.equal(minimumOfferAmountToDb("1,200.5"), 1200.5)
  })

  it("rejects zero and non-positive amounts", () => {
    assert.equal(minimumOfferAmountToDb("0"), null)
    assert.equal(minimumOfferAmountToDb("-10"), null)
    assert.equal(minimumOfferAmountToDb("abc"), null)
  })
})

describe("minimumOfferAmountFromDb", () => {
  it("hydrates a blank sell-form value when the listing has no fixed minimum", () => {
    assert.equal(minimumOfferAmountFromDb(undefined), "")
    assert.equal(minimumOfferAmountFromDb(null), "")
    assert.equal(minimumOfferAmountFromDb(""), "")
  })

  it("round-trips a stored minimum into the sell-form string", () => {
    assert.equal(minimumOfferAmountFromDb(650), "650")
    assert.equal(minimumOfferAmountFromDb("650.00"), "650")
  })
})

describe("effectiveMinimumOfferAmount", () => {
  it("uses the fixed amount when set, otherwise 70% of list price", () => {
    assert.equal(effectiveMinimumOfferAmount({ minimum_offer_amount: 650 }, 900), 650)
    assert.equal(effectiveMinimumOfferAmount({}, 900), 630)
  })
})
