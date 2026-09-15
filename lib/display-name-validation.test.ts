import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { validateDisplayName } from "./display-name-validation.ts"

describe("validateDisplayName", () => {
  it("rejects Reswell Support impersonation", () => {
    assert.equal(validateDisplayName("RESWELL SUPPORT").valid, false)
    assert.equal(validateDisplayName("Reswell Support").valid, false)
    assert.equal(validateDisplayName("reswell-support").valid, false)
    assert.equal(validateDisplayName("ReswellSupport").valid, false)
  })

  it("allows ordinary names", () => {
    assert.equal(validateDisplayName("Jordan").valid, true)
    assert.equal(validateDisplayName("Creswell").valid, true)
  })
})
