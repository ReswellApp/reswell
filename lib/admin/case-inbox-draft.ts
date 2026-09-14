export type CaseComposerMode = "reply" | "note"

export type StoredCaseComposerDraft = {
  body: string
  mode: CaseComposerMode
  suggestionId: string | null
}

export function parseStoredCaseComposerDraft(raw: string | null): StoredCaseComposerDraft | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== "object" || value === null || !("body" in value) || typeof value.body !== "string") {
      return null
    }
    const mode =
      "mode" in value && (value.mode === "reply" || value.mode === "note") ? value.mode : "reply"
    const suggestionId =
      "suggestionId" in value && typeof value.suggestionId === "string" && value.suggestionId
        ? value.suggestionId
        : null
    return { body: value.body, mode, suggestionId }
  } catch {
    return null
  }
}

export function serializeStoredCaseComposerDraft(draft: StoredCaseComposerDraft): string {
  return JSON.stringify({
    body: draft.body,
    mode: draft.mode,
    suggestionId: draft.suggestionId,
  })
}

export function storedDraftIsReplaceableSuggestion(draft: StoredCaseComposerDraft | null): boolean {
  return Boolean(draft?.suggestionId && draft.body.trim())
}
