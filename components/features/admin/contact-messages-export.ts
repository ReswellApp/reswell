import type { ContactMessageRow } from "@/lib/db/contactMessages"
import { CHANNEL_LABEL, STATUS_LABEL } from "@/components/features/admin/contact-messages-labels"

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return ""
  const str = String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

const CSV_HEADERS = [
  "Ticket ID",
  "Received",
  "Updated",
  "Channel",
  "Status",
  "Name",
  "Email",
  "User ID",
  "Topic",
  "Message",
  "Support thread",
  "Internal notes",
] as const

/**
 * Builds a CSV string from the supplied (already-filtered) ticket list. Pure so
 * it can be unit-tested; the browser download is handled by `downloadTicketsCsv`.
 */
export function buildTicketsCsv(rows: ContactMessageRow[]): string {
  const lines = rows.map((row) => [
    row.id,
    row.created_at,
    row.updated_at,
    CHANNEL_LABEL[row.source],
    STATUS_LABEL[row.support_status],
    row.name,
    row.email,
    row.user_id ?? "",
    row.subject ?? "",
    row.message,
    row.support_conversation_id ?? "",
    row.internal_notes ?? "",
  ])

  return [CSV_HEADERS, ...lines].map((line) => line.map(csvCell).join(",")).join("\n")
}

export function downloadTicketsCsv(rows: ContactMessageRow[]): void {
  const csv = buildTicketsCsv(rows)
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  const stamp = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `reswell-support-inbox-${stamp}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
