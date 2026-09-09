import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isDashboardSupportDeskPath } from "./dashboard-support-path.ts"

describe("isDashboardSupportDeskPath", () => {
  it("matches the signed-in support desk only", () => {
    assert.equal(isDashboardSupportDeskPath("/dashboard/support"), true)
    assert.equal(isDashboardSupportDeskPath("/dashboard/support/"), true)
    assert.equal(isDashboardSupportDeskPath("/dashboard/support/new"), false)
    assert.equal(isDashboardSupportDeskPath("/dashboard"), false)
    assert.equal(isDashboardSupportDeskPath("/support"), false)
  })
})
