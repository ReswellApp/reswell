/**
 * Live chat is not on main yet. Localhost sessions (and leftover `live_chat`
 * sidecars) must not open or appear as Cases until the widget ships.
 */
export function isUnpublishedLiveChatTicket(row: {
  source?: string | null
  source_channel?: string | null
  subject?: string | null
}): boolean {
  const channel = (row.source_channel ?? row.source ?? "").trim().toLowerCase()
  if (channel === "live_chat") return true
  return (row.subject ?? "").trim().startsWith("Live chat")
}
