import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  parseStoredCaseComposerDraft,
  serializeStoredCaseComposerDraft,
  storedDraftIsReplaceableSuggestion,
} from "./case-inbox-draft.ts"

describe("case inbox composer draft storage", () => {
  it("restores a previous AI suggestion so a newer server draft can replace it", () => {
    const stored = serializeStoredCaseComposerDraft({
      body: "Old suggested reply",
      mode: "reply",
      suggestionId: "draft-1",
    })
    const parsed = parseStoredCaseComposerDraft(stored)
    assert.deepEqual(parsed, {
      body: "Old suggested reply",
      mode: "reply",
      suggestionId: "draft-1",
    })
    assert.equal(storedDraftIsReplaceableSuggestion(parsed), true)
  })

  it("treats Hayden's typed reply as not replaceable", () => {
    const stored = serializeStoredCaseComposerDraft({
      body: "I already started this",
      mode: "reply",
      suggestionId: null,
    })
    const parsed = parseStoredCaseComposerDraft(stored)
    assert.equal(storedDraftIsReplaceableSuggestion(parsed), false)
  })

  it("reads the legacy session shape without a suggestion id", () => {
    const parsed = parseStoredCaseComposerDraft(
      JSON.stringify({ body: "Legacy typed draft", mode: "note" }),
    )
    assert.deepEqual(parsed, {
      body: "Legacy typed draft",
      mode: "note",
      suggestionId: null,
    })
    assert.equal(storedDraftIsReplaceableSuggestion(parsed), false)
  })
})
