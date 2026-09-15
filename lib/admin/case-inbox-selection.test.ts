import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  findInboxItemBySelection,
  firstNonEmptyText,
  inboxItemPassesMineFilter,
  inboxLoadQueryKey,
  mergeInboxPageItems,
  nextInboxSelectedKey,
  pinSelectedInboxItem,
  shouldApplyInboxLoad,
} from "./case-inbox-selection.ts"

describe("firstNonEmptyText", () => {
  it("skips empty sidecar bodies so the customer request still shows", () => {
    assert.equal(firstNonEmptyText("", "  ", "Ding on the deck"), "Ding on the deck")
    assert.equal(firstNonEmptyText(null, undefined, "Need help"), "Need help")
  })
})

describe("findInboxItemBySelection", () => {
  const caseId = "11111111-1111-4111-8111-111111111111"
  const contactId = "22222222-2222-4222-8222-222222222222"
  const orderSupportId = "33333333-3333-4333-8333-333333333333"
  const orderId = "44444444-4444-4444-8444-444444444444"
  const row = {
    key: `sc:${caseId}`,
    id: caseId,
    orderId,
    contact: { id: contactId },
    order: { id: orderSupportId },
  }

  it("matches support_case, contact_message, and order ids", () => {
    assert.equal(findInboxItemBySelection([row], `sc:${caseId}`)?.key, row.key)
    assert.equal(findInboxItemBySelection([row], `cm:${contactId}`)?.key, row.key)
    assert.equal(findInboxItemBySelection([row], `sc:${contactId}`)?.key, row.key)
    assert.equal(findInboxItemBySelection([row], contactId)?.key, row.key)
    assert.equal(findInboxItemBySelection([row], `os:${orderSupportId}`)?.key, row.key)
    assert.equal(findInboxItemBySelection([row], orderId)?.key, row.key)
  })

  it("treats those same-thread keys as a customer-panel SSR seed match", () => {
    assert.ok(findInboxItemBySelection([row], `cm:${contactId}`))
    assert.ok(findInboxItemBySelection([row], `os:${orderSupportId}`))
    assert.ok(findInboxItemBySelection([row], orderId))
    assert.equal(findInboxItemBySelection([row], "sc:someone-else"), null)
  })
})

describe("nextInboxSelectedKey", () => {
  it("keeps the open case after a reply removes it from the current view", () => {
    assert.equal(
      nextInboxSelectedKey({
        items: [{ key: "sc:replied" }, { key: "sc:other" }],
        filtered: [{ key: "sc:other" }],
        selectedKey: "sc:replied",
        loading: false,
      }),
      undefined,
    )
  })

  it("does not clear the pane when the current view list is empty", () => {
    assert.equal(
      nextInboxSelectedKey({
        items: [{ key: "sc:only" }],
        filtered: [],
        selectedKey: "sc:only",
        loading: false,
      }),
      undefined,
    )
  })

  it("normalizes a contact-message deep link to the inbox row key", () => {
    const caseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const contactId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    assert.equal(
      nextInboxSelectedKey({
        items: [
          { key: `sc:${caseId}`, id: caseId, contact: { id: contactId } },
          { key: "sc:first", id: "first" },
        ],
        filtered: [
          { key: "sc:first", id: "first" },
          { key: `sc:${caseId}`, id: caseId, contact: { id: contactId } },
        ],
        selectedKey: `sc:${contactId}`,
        loading: false,
      }),
      `sc:${caseId}`,
    )
  })

  it("does not fall through to the first sorted ticket for an unresolved deep link", () => {
    assert.equal(
      nextInboxSelectedKey({
        items: [{ key: "sc:first" }, { key: "sc:second" }],
        filtered: [{ key: "sc:first" }, { key: "sc:second" }],
        selectedKey: "sc:missing-contact",
        loading: false,
      }),
      null,
    )
  })
})

describe("pinSelectedInboxItem", () => {
  it("keeps the replied-to case visible in the list", () => {
    const open = { key: "sc:replied" }
    const pinned = pinSelectedInboxItem([{ key: "sc:other" }], open)
    assert.equal(pinned[0]?.key, "sc:replied")
    assert.equal(pinned.length, 2)
  })
})

describe("shouldApplyInboxLoad", () => {
  const open = inboxLoadQueryKey({ view: "open", type: "all", sort: "smart", search: "" })
  const mine = inboxLoadQueryKey({ view: "mine", type: "all", sort: "smart", search: "" })

  it("drops a stale page after the query generation moves on", () => {
    assert.equal(
      shouldApplyInboxLoad({
        mode: "page",
        requestGeneration: 1,
        currentGeneration: 2,
        requestQueryKey: open,
        currentQueryKey: mine,
      }),
      false,
    )
  })

  it("drops a page whose query no longer matches even if generation stayed", () => {
    assert.equal(
      shouldApplyInboxLoad({
        mode: "page",
        requestGeneration: 1,
        currentGeneration: 1,
        requestQueryKey: open,
        currentQueryKey: mine,
      }),
      false,
    )
  })

  it("applies a page that still matches the current query", () => {
    assert.equal(
      shouldApplyInboxLoad({
        mode: "page",
        requestGeneration: 1,
        currentGeneration: 1,
        requestQueryKey: mine,
        currentQueryKey: mine,
      }),
      true,
    )
  })
})

describe("inboxItemPassesMineFilter", () => {
  it("keeps hydrated Mine rows while staff id is unknown", () => {
    assert.equal(inboxItemPassesMineFilter("staff-1", null), true)
    assert.equal(inboxItemPassesMineFilter("staff-2", null), true)
  })

  it("filters to the current staff member once id is known", () => {
    assert.equal(inboxItemPassesMineFilter("staff-1", "staff-1"), true)
    assert.equal(inboxItemPassesMineFilter("staff-2", "staff-1"), false)
  })
})

describe("mergeInboxPageItems", () => {
  it("appends unseen keys only", () => {
    const merged = mergeInboxPageItems([{ key: "sc:a" }], [{ key: "sc:a" }, { key: "sc:b" }])
    assert.deepEqual(merged.map((item) => item.key), ["sc:a", "sc:b"])
  })
})
