import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { latestEligibleBirthDateIso } from "@reswell/api-contract"
import { parseSignupDateOfBirthParam } from "./signup-date-of-birth.ts"

describe("parseSignupDateOfBirthParam", () => {
  it("accepts an eligible ISO date", () => {
    const iso = latestEligibleBirthDateIso()
    assert.equal(parseSignupDateOfBirthParam(iso), iso)
  })

  it("ignores missing or underage values", () => {
    assert.equal(parseSignupDateOfBirthParam(null), null)
    assert.equal(parseSignupDateOfBirthParam("not-a-date"), null)
    assert.equal(parseSignupDateOfBirthParam("2015-01-01"), null)
  })
})
