import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  filterSupportHubCategories,
  helpHubHref,
  parseHelpHubDirect,
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

  it("deep-links the skip-to-team path", () => {
    assert.equal(supportHubHref({ direct: true }), "/support?direct=1")
  })
})

describe("helpHubHref direct", () => {
  it("opens the signed-in hub on the freeform message", () => {
    assert.equal(helpHubHref({ direct: true }), "/dashboard/support?direct=1")
  })
})

describe("parseHelpHubDirect", () => {
  it("accepts 1 and true", () => {
    assert.equal(parseHelpHubDirect("1"), true)
    assert.equal(parseHelpHubDirect("true"), true)
    assert.equal(parseHelpHubDirect("0"), false)
    assert.equal(parseHelpHubDirect(undefined), false)
  })
})
