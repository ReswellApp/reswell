export type CaseComposerMode = "reply" | "note"

export type StoredCaseComposerDraft = {
  body: string
  mode: CaseComposerMode
  suggestionId: string | null
  dismissed?: boolean
  rewritePrompt?: string
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
    const dismissed = "dismissed" in value && value.dismissed === true
    const rewritePrompt =
      "rewritePrompt" in value && typeof value.rewritePrompt === "string" ? value.rewritePrompt : ""
    return { body: value.body, mode, suggestionId, dismissed, rewritePrompt }
  } catch {
    return null
  }
}

export function serializeStoredCaseComposerDraft(draft: StoredCaseComposerDraft): string {
  return JSON.stringify({
    body: draft.body,
    mode: draft.mode,
    suggestionId: draft.suggestionId,
    dismissed: draft.dismissed === true,
    rewritePrompt: draft.rewritePrompt ?? "",
  })
}

export function storedDraftIsReplaceableSuggestion(draft: StoredCaseComposerDraft | null): boolean {
  return Boolean(draft?.suggestionId && draft.body.trim())
}

/** Empty composer after Hayden cleared a suggestion is freeform — do not refill it. */
export function shouldApplyInboxSuggestion(args: {
  currentBody: string
  appliedBody: string | null
  nextBody: string
  rewriteRequested: boolean
  dismissed: boolean
}): boolean {
  const next = args.nextBody.trim()
  if (!next) return false
  if (args.rewriteRequested) return true
  if (args.dismissed) return false
  const current = args.currentBody.trim()
  const applied = (args.appliedBody ?? "").trim()
  if (current === next) return false
  if (current && current !== applied) return false
  if (!current && applied) return false
  return true
}

/** Apply a suggestion only when it belongs to the case currently in the composer. */
export function inboxSuggestionBelongsToSelectedCase(args: {
  selectedCaseId: string | null | undefined
  composerCaseId: string | null | undefined
  suggestionCaseId: string | null | undefined
}): boolean {
  const selected = args.selectedCaseId
  return Boolean(
    selected && args.composerCaseId === selected && args.suggestionCaseId === selected,
  )
}
