import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  inboxSuggestionBelongsToSelectedCase,
  parseStoredCaseComposerDraft,
  serializeStoredCaseComposerDraft,
  shouldApplyInboxSuggestion,
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
      dismissed: false,
      rewritePrompt: "",
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

  it("restores a dismissed empty composer and rewrite prompt", () => {
    const stored = serializeStoredCaseComposerDraft({
      body: "",
      mode: "reply",
      suggestionId: null,
      dismissed: true,
      rewritePrompt: "Offer a box",
    })
    const parsed = parseStoredCaseComposerDraft(stored)
    assert.deepEqual(parsed, {
      body: "",
      mode: "reply",
      suggestionId: null,
      dismissed: true,
      rewritePrompt: "Offer a box",
    })
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
      dismissed: false,
      rewritePrompt: "",
    })
    assert.equal(storedDraftIsReplaceableSuggestion(parsed), false)
  })
})

describe("inboxSuggestionBelongsToSelectedCase", () => {
  it("rejects a leftover suggestion from the previous conversation", () => {
    assert.equal(
      inboxSuggestionBelongsToSelectedCase({
        selectedCaseId: "case-b",
        composerCaseId: "case-a",
        suggestionCaseId: "case-a",
      }),
      false,
    )
  })

  it("rejects a suggestion whose case id does not match the selected ticket", () => {
    assert.equal(
      inboxSuggestionBelongsToSelectedCase({
        selectedCaseId: "case-b",
        composerCaseId: "case-b",
        suggestionCaseId: "case-a",
      }),
      false,
    )
  })

  it("accepts a suggestion only when selected, composer, and draft agree", () => {
    assert.equal(
      inboxSuggestionBelongsToSelectedCase({
        selectedCaseId: "case-b",
        composerCaseId: "case-b",
        suggestionCaseId: "case-b",
      }),
      true,
    )
  })
})

describe("shouldApplyInboxSuggestion", () => {
  const next = "Thanks for writing in."

  it("fills an empty composer on first load", () => {
    assert.equal(
      shouldApplyInboxSuggestion({
        currentBody: "",
        appliedBody: null,
        nextBody: next,
        rewriteRequested: false,
        dismissed: false,
      }),
      true,
    )
  })

  it("does not refill after Hayden deletes the suggestion", () => {
    assert.equal(
      shouldApplyInboxSuggestion({
        currentBody: "",
        appliedBody: next,
        nextBody: next,
        rewriteRequested: false,
        dismissed: false,
      }),
      false,
    )
  })

  it("does not refill when the empty composer was dismissed", () => {
    assert.equal(
      shouldApplyInboxSuggestion({
        currentBody: "",
        appliedBody: null,
        nextBody: next,
        rewriteRequested: false,
        dismissed: true,
      }),
      false,
    )
  })

  it("does not overwrite a typed reply", () => {
    assert.equal(
      shouldApplyInboxSuggestion({
        currentBody: "I already started this",
        appliedBody: next,
        nextBody: "A newer draft",
        rewriteRequested: false,
        dismissed: false,
      }),
      false,
    )
  })

  it("replaces a still-showing suggestion when Rewrite returns a new draft", () => {
    assert.equal(
      shouldApplyInboxSuggestion({
        currentBody: next,
        appliedBody: next,
        nextBody: "Shorter rewrite.",
        rewriteRequested: true,
        dismissed: false,
      }),
      true,
    )
  })

  it("applies a Rewrite into a cleared composer", () => {
    assert.equal(
      shouldApplyInboxSuggestion({
        currentBody: "",
        appliedBody: next,
        nextBody: "Shorter rewrite.",
        rewriteRequested: true,
        dismissed: true,
      }),
      true,
    )
  })
})
