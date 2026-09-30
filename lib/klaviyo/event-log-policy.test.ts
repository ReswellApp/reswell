import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { shouldRecordKlaviyoEventLog } from "./event-log-policy.ts"

describe("shouldRecordKlaviyoEventLog", () => {
  it("does not mirror page-view events into Postgres", () => {
    assert.equal(shouldRecordKlaviyoEventLog("Viewed Site Page"), false)
    assert.equal(shouldRecordKlaviyoEventLog("Viewed Product"), false)
    assert.equal(shouldRecordKlaviyoEventLog("Viewed Sell Page"), false)
  })

  it("keeps durable admin logging for non-page-view events", () => {
    assert.equal(shouldRecordKlaviyoEventLog("Purchase Successful"), true)
    assert.equal(shouldRecordKlaviyoEventLog("Message Sent"), true)
  })
})
