import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  adminSupportCaseHref,
  inboxCaseKey,
  parseInboxCaseParam,
  supportCaseResponseHref,
} from "./support-case-paths.ts"

describe("adminSupportCaseHref", () => {
  it("opens the inbox with the case selected", () => {
    const id = "11111111-1111-4111-8111-111111111111"
    assert.equal(adminSupportCaseHref(id), `/admin/contact-messages?case=sc%3A${id}`)
    assert.equal(inboxCaseKey(id), `sc:${id}`)
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
