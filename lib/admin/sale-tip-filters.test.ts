import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  adminSaleTipListHref,
  adminSaleTipStatusPresentation,
  isAdminSaleTipStatus,
  sanitizeAdminSaleTipSearch,
  summarizeSucceededTips,
} from "./sale-tip-filters.ts"

describe("sale tip admin filters", () => {
  it("recognizes stored tip statuses", () => {
    assert.equal(isAdminSaleTipStatus("succeeded"), true)
    assert.equal(isAdminSaleTipStatus("refunded"), false)
  })

  it("strips filter punctuation from search text", () => {
    assert.equal(
      sanitizeAdminSaleTipSearch('  ada@reswell.com, "or".eq  '),
      "ada@reswell.com or.eq",
    )
  })

  it("sums paid tips and counts distinct sellers", () => {
    const summary = summarizeSucceededTips([
      { amountCents: 500, sellerUserId: "a" },
      { amountCents: 250, sellerUserId: "a" },
      { amountCents: 100, sellerUserId: "b" },
      { amountCents: 0, sellerUserId: "c" },
    ])
    assert.deepEqual(summary, { amountCents: 850, sellerCount: 3 })
  })

  it("omits the default paid filter from the ledger url", () => {
    assert.equal(
      adminSaleTipListHref({ status: "succeeded", q: "", seller: "", page: 1 }),
      "/admin/sale-tips",
    )
    assert.equal(
      adminSaleTipListHref({ status: "all", q: "ada", seller: "", page: 2 }),
      "/admin/sale-tips?status=all&q=ada&page=2",
    )
  })

  it("labels a paid tip", () => {
    assert.deepEqual(adminSaleTipStatusPresentation("succeeded"), {
      label: "Paid",
      tone: "green",
    })
  })
})
