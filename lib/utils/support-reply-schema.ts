/** PostgREST / Postgres errors when draft harness columns are not migrated. */
export function isMissingDraftHarnessColumn(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("reason") ||
    lower.includes("citations") ||
    lower.includes("could not find the") ||
    lower.includes("schema cache")
  )
}

/** PostgREST / Postgres errors when example coaching columns are not migrated. */
export function isMissingExampleExtendedColumn(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("rating_note") ||
    lower.includes("source_channel") ||
    lower.includes("could not find the") ||
    lower.includes("schema cache")
  )
}
