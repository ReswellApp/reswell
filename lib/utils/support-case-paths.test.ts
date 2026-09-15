import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  adminSupportCaseHref,
  inboxCaseKey,
  inboxContactKey,
  inboxSelectionKey,
  isSupportCaseThreadRoute,
  parseInboxCaseParam,
  supportCaseResponseHref,
} from "./support-case-paths.ts"

describe("adminSupportCaseHref", () => {
  it("opens the inbox with the case selected", () => {
    const id = "11111111-1111-4111-8111-111111111111"
    assert.equal(adminSupportCaseHref(id), `/admin/contact-messages?case=sc%3A${id}`)
    assert.equal(inboxCaseKey(id), `sc:${id}`)
  })

  it("keeps contact and order prefixes so deep links stay resolvable", () => {
    const contactId = "22222222-2222-4222-8222-222222222222"
    const orderSupportId = "33333333-3333-4333-8333-333333333333"
    assert.equal(inboxContactKey(contactId), `cm:${contactId}`)
    assert.equal(inboxSelectionKey(`cm:${contactId}`), `cm:${contactId}`)
    assert.equal(
      adminSupportCaseHref(`cm:${contactId}`),
      `/admin/contact-messages?case=cm%3A${contactId}`,
    )
    assert.equal(
      adminSupportCaseHref(`os:${orderSupportId}`),
      `/admin/contact-messages?case=os%3A${orderSupportId}`,
    )
  })
})

describe("parseInboxCaseParam", () => {
  it("accepts sc, cm, os, and raw ids", () => {
    const id = "11111111-1111-4111-8111-111111111111"
    assert.equal(parseInboxCaseParam(`sc:${id}`), id)
    assert.equal(parseInboxCaseParam(`cm:${id}`), id)
    assert.equal(parseInboxCaseParam(`os:${id}`), id)
    assert.equal(parseInboxCaseParam(id), id)
    assert.equal(parseInboxCaseParam("  "), null)
    assert.equal(parseInboxCaseParam(null), null)
  })
})

describe("supportCaseResponseHref", () => {
  it("stays on the member thread", () => {
    assert.equal(supportCaseResponseHref("abc"), "/support/abc")
  })
})

describe("isSupportCaseThreadRoute", () => {
  it("matches the member case panel, not the hub", () => {
    assert.equal(isSupportCaseThreadRoute("/support/abc"), true)
    assert.equal(isSupportCaseThreadRoute("/support/abc/"), true)
    assert.equal(isSupportCaseThreadRoute("/support"), false)
    assert.equal(isSupportCaseThreadRoute("/dashboard/support"), false)
    assert.equal(isSupportCaseThreadRoute("/messages/abc"), false)
    assert.equal(isSupportCaseThreadRoute(null), false)
  })
})
