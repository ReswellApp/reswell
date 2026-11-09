import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { expandUspsAbbreviatedCityName } from "./usps-city-name.ts"

describe("expandUspsAbbreviatedCityName", () => {
  it("expands Virginia Beach from the USPS preferred abbreviation", () => {
    assert.equal(expandUspsAbbreviatedCityName("VIRGINIA BCH"), "Virginia Beach")
    assert.equal(expandUspsAbbreviatedCityName("Virginia Bch"), "Virginia Beach")
  })

  it("leaves full city names and empty values alone", () => {
    assert.equal(expandUspsAbbreviatedCityName("Virginia Beach"), "Virginia Beach")
    assert.equal(expandUspsAbbreviatedCityName("SANTA BARBARA"), "SANTA BARBARA")
    assert.equal(expandUspsAbbreviatedCityName(""), "")
    assert.equal(expandUspsAbbreviatedCityName(null), "")
  })
})
