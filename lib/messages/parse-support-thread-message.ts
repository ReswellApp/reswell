/**
 * Parse legacy / structured support thread system messages so UI can render
 * them as cards instead of raw multi-line bubbles.
 */

export type ParsedSupportCaseOpenedMessage = {
  kind: "opened"
  topicLabel: string
  body: string
  ticketId: string | null
}

export type ParsedSupportCaseStatusMessage = {
  kind: "status"
  line: string
  ticketId: string | null
}

export type ParsedSupportThreadSystemMessage =
  | ParsedSupportCaseOpenedMessage
  | ParsedSupportCaseStatusMessage

function extractTicketId(text: string): string | null {
  const m = text.match(/Ticket ID:\s*([0-9a-f-]{36}|RS-[A-Z0-9]+)/i)
  return m?.[1]?.trim() ?? null
}

/** Legacy wall-of-text opening from formatSupportTicketOpeningMessage. */
export function parseSupportTicketOpeningContent(
  content: string,
): ParsedSupportCaseOpenedMessage | null {
  const trimmed = content.trim()
  if (!trimmed.startsWith("Reswell support ticket")) return null

  const topicMatch = trimmed.match(/Topic:\s*(.+?)(?:\n|$)/i)
  const topicLabel = topicMatch?.[1]?.trim() || "Support request"

  const parts = trimmed.split(/\n—\n/)
  let body = ""
  if (parts.length >= 2) {
    body = parts[1]?.trim() ?? ""
  } else {
    const afterTopic = trimmed.replace(/^Reswell support ticket\s*/i, "").replace(/Topic:.*\n*/i, "")
    body = afterTopic.replace(/Ticket ID:.*$/is, "").trim()
  }

  // Drop footer lines from body if they leaked in
  body = body
    .replace(/\n*Ticket ID:.*$/is, "")
    .replace(/\n*You’ll get updates[\s\S]*$/i, "")
    .replace(/\n*You'll get updates[\s\S]*$/i, "")
    .trim()

  return {
    kind: "opened",
    topicLabel,
    body: body || topicLabel,
    ticketId: extractTicketId(trimmed),
  }
}

export function parseSupportTicketStatusContent(
  content: string,
): ParsedSupportCaseStatusMessage | null {
  const trimmed = content.trim()
  if (!trimmed.startsWith("Reswell — ticket update") && !trimmed.startsWith("Reswell - ticket update")) {
    return null
  }
  const lines = trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  const statusLine =
    lines.find((l) => l.toLowerCase().startsWith("status:")) ??
    lines.find((l) => !l.startsWith("Reswell") && !l.startsWith("Ticket ID")) ??
    "Status updated"

  return {
    kind: "status",
    line: statusLine,
    ticketId: extractTicketId(trimmed),
  }
}

export function parseSupportThreadSystemMessage(
  content: string,
): ParsedSupportThreadSystemMessage | null {
  return parseSupportTicketOpeningContent(content) ?? parseSupportTicketStatusContent(content)
}

/** Internal status lines — hide these from the customer thread. */
export function isSupportStatusUpdateMessage(body: string): boolean {
  const trimmed = body.trim()
  if (/^status updated\b/i.test(trimmed)) return true
  if (/^this (case|conversation|request) (is|has been) (closed|resolved|marked resolved)\b/i.test(trimmed)) {
    return true
  }
  return parseSupportTicketStatusContent(trimmed) != null
}
