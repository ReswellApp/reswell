/** PostgREST / Postgres missing-column shape for one named column. */
function isMissingNamedColumn(message: string, column: string): boolean {
  const lower = message.toLowerCase()
  const col = column.toLowerCase()
  const named =
    lower.includes(`'${col}'`) ||
    lower.includes(`"${col}"`) ||
    lower.includes(`.${col}`) ||
    lower.includes(`column ${col}`) ||
    lower.includes(`${col} does not exist`)
  if (!named) return false
  return (
    lower.includes("does not exist") ||
    lower.includes("schema cache") ||
    lower.includes("pgrst204") ||
    lower.includes("could not find the")
  )
}

/** PostgREST / Postgres errors when draft harness columns are not migrated. */
export function isMissingDraftHarnessColumn(message: string): boolean {
  return isMissingNamedColumn(message, "reason") || isMissingNamedColumn(message, "citations")
}

/** PostgREST / Postgres errors when example `rating_note` is not migrated. */
export function isMissingExampleRatingNoteColumn(message: string): boolean {
  return isMissingNamedColumn(message, "rating_note")
}

/** PostgREST / Postgres errors when example `source_channel` is not migrated. */
export function isMissingExampleSourceChannelColumn(message: string): boolean {
  return isMissingNamedColumn(message, "source_channel")
}

/** Either example coaching column is missing — do not use this to latch both. */
export function isMissingExampleExtendedColumn(message: string): boolean {
  return isMissingExampleRatingNoteColumn(message) || isMissingExampleSourceChannelColumn(message)
}

export type SupportReplyExampleColumnSet = "full" | "channel" | "base"

/** `rating_note` can miss while `source_channel` is still writable. */
export function exampleColumnSet(args: {
  nowMs?: number
  ratingNoteUnavailableUntilMs: number
  sourceChannelUnavailableUntilMs: number
}): SupportReplyExampleColumnSet {
  const now = args.nowMs ?? Date.now()
  if (now < args.sourceChannelUnavailableUntilMs) return "base"
  if (now < args.ratingNoteUnavailableUntilMs) return "channel"
  return "full"
}
