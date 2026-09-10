import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  firstNonEmptyText,
  nextInboxSelectedKey,
  pinSelectedInboxItem,
} from "./case-inbox-selection.ts"

describe("firstNonEmptyText", () => {
  it("skips empty sidecar bodies so the customer request still shows", () => {
    assert.equal(firstNonEmptyText("", "  ", "Ding on the deck"), "Ding on the deck")
    assert.equal(firstNonEmptyText(null, undefined, "Need help"), "Need help")
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
})

describe("pinSelectedInboxItem", () => {
  it("keeps the replied-to case visible in the list", () => {
    const open = { key: "sc:replied" }
    const pinned = pinSelectedInboxItem([{ key: "sc:other" }], open)
    assert.equal(pinned[0]?.key, "sc:replied")
    assert.equal(pinned.length, 2)
  })
})
