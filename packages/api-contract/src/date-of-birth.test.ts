import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DATE_OF_BIRTH_REQUIRED_MESSAGE,
  DATE_OF_BIRTH_UNDERAGE_MESSAGE,
  dateOfBirthMeetsMinimumAge,
  formatIsoDateOnly,
  latestEligibleBirthDateIso,
  parseIsoDateOnly,
  signupDateOfBirthSchema,
} from "./date-of-birth.ts"

describe("signupDateOfBirthSchema", () => {
  it("accepts a birthday that is exactly 18 years ago", () => {
    const parsed = signupDateOfBirthSchema.safeParse(latestEligibleBirthDateIso())
    assert.equal(parsed.success, true)
  })

  it("rejects a missing date", () => {
    const parsed = signupDateOfBirthSchema.safeParse("")
    assert.equal(parsed.success, false)
    if (parsed.success) return
    assert.equal(parsed.error.issues[0]?.message, DATE_OF_BIRTH_REQUIRED_MESSAGE)
  })

  it("rejects an underage birthday", () => {
    const latest = parseIsoDateOnly(latestEligibleBirthDateIso())
    assert.ok(latest)
    const tooYoung = new Date(latest.year, latest.month - 1, latest.day + 1)
    const parsed = signupDateOfBirthSchema.safeParse(
      formatIsoDateOnly(tooYoung.getFullYear(), tooYoung.getMonth() + 1, tooYoung.getDate()),
    )
    assert.equal(parsed.success, false)
    if (parsed.success) return
    assert.equal(parsed.error.issues[0]?.message, DATE_OF_BIRTH_UNDERAGE_MESSAGE)
  })

  it("rejects an impossible calendar date", () => {
    assert.equal(parseIsoDateOnly("2020-02-31"), null)
    assert.equal(dateOfBirthMeetsMinimumAge("2020-02-31"), false)
  })
})
