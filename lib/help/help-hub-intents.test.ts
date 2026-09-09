import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  filterSupportHubCategories,
  helpHubHref,
  SUPPORT_HUB_CATEGORIES,
  supportHubHref,
} from "./help-hub-intents.ts"

describe("filterSupportHubCategories", () => {
  it("returns every category when the query is empty", () => {
    assert.equal(filterSupportHubCategories("").length, SUPPORT_HUB_CATEGORIES.length)
  })

  it("matches purchase and claim tiles for order language", () => {
    const ids = filterSupportHubCategories("tracking").map((c) => c.id)
    assert.ok(ids.includes("purchase"))
  })

  it("matches the admin claim kind", () => {
    const ids = filterSupportHubCategories("protection").map((c) => c.id)
    assert.deepEqual(ids, ["claim"])
  })
})

describe("helpHubHref", () => {
  it("opens the signed-in support hub", () => {
    assert.equal(helpHubHref(), "/dashboard/support")
  })

  it("keeps purchase and sale deep links for admin-aligned intake", () => {
    assert.equal(
      helpHubHref({ intent: "order", role: "seller", orderId: "abc" }),
      "/dashboard/support?intent=order&orderId=abc&role=seller",
    )
  })
})

describe("supportHubHref", () => {
  it("points at the public /support hub", () => {
    assert.equal(supportHubHref(), "/support")
  })
})
