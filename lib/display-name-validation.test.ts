import assert from "node:assert/strict"
import { describe, it } from "node:test"
<<<<<<< HEAD

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
=======
import { validateDisplayName } from "./display-name-validation.ts"

function assertBlocked(name: string) {
  const result = validateDisplayName(name)
  assert.equal(result.valid, false)
  if (!result.valid) {
    assert.match(result.error, /not allowed/i)
  }
}

describe("validateDisplayName impersonation", () => {
  it("blocks official-looking Reswell staff names in both orders", () => {
    assertBlocked("RESWELL SUPPORT")
    assertBlocked("support reswell")
    assertBlocked("reswell help")
    assertBlocked("help reswell")
    assertBlocked("Help Res Well")
    assertBlocked("reswell")
    assertBlocked("res well")
  })

  it("allows ordinary names that only mention Reswell as a community identity", () => {
    assert.equal(validateDisplayName("Hayden").valid, true)
    assert.equal(validateDisplayName("Reswell Fan").valid, true)
    assert.equal(validateDisplayName("helpful buyer").valid, true)
>>>>>>> ec0327c5cd55e6cddb43092aa1c302943de40493
  })
})
