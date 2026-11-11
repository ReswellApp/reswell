import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { META_DEFAULT_CURRENCY, metaIsoCurrency, metaValueAndCurrency } from "./currency.ts"

describe("metaIsoCurrency", () => {
  it("returns USD for missing, blank, or non-string values", () => {
    assert.equal(metaIsoCurrency(undefined), META_DEFAULT_CURRENCY)
    assert.equal(metaIsoCurrency(null), META_DEFAULT_CURRENCY)
    assert.equal(metaIsoCurrency(""), META_DEFAULT_CURRENCY)
    assert.equal(metaIsoCurrency("   "), META_DEFAULT_CURRENCY)
    assert.equal(metaIsoCurrency(0), META_DEFAULT_CURRENCY)
    assert.equal(metaIsoCurrency(450), META_DEFAULT_CURRENCY)
  })

  it("uppercases valid ISO 4217 codes", () => {
    assert.equal(metaIsoCurrency("usd"), "USD")
    assert.equal(metaIsoCurrency(" Eur "), "EUR")
  })

  it("rejects symbols, names, and 3-letter junk Meta would log as invalid", () => {
    assert.equal(metaIsoCurrency("$"), META_DEFAULT_CURRENCY)
    assert.equal(metaIsoCurrency("US$"), META_DEFAULT_CURRENCY)
    assert.equal(metaIsoCurrency("US Dollar"), META_DEFAULT_CURRENCY)
    assert.equal(metaIsoCurrency("ABC"), META_DEFAULT_CURRENCY)
  })
})

describe("metaValueAndCurrency", () => {
  it("omits non-positive amounts so currency is never sent alone", () => {
    assert.equal(metaValueAndCurrency(undefined), null)
    assert.equal(metaValueAndCurrency(0), null)
    assert.equal(metaValueAndCurrency(-1), null)
    assert.equal(metaValueAndCurrency("nope"), null)
  })

  it("pairs a rounded amount with a valid currency", () => {
    assert.deepEqual(metaValueAndCurrency(12.345, "$"), { value: 12.35, currency: "USD" })
    assert.deepEqual(metaValueAndCurrency("99", "eur"), { value: 99, currency: "EUR" })
  })
})
