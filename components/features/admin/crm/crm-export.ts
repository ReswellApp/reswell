import { crmContactDisplayName, type CrmContactWithProfile } from "@/lib/db/crm"
import {
  CRM_PRIORITY_LABEL,
  CRM_SOURCE_LABEL,
  CRM_STATUS_LABEL,
  contactNeedsFollowUp,
} from "@/components/features/admin/crm/crm-labels"

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return ""
  const str = String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

const CSV_HEADERS = [
  "Name",
  "Email",
  "Phone",
  "Source",
  "Status",
  "Priority",
  "Needs follow-up",
  "Last contacted",
  "Next follow-up",
  "Added",
] as const

/**
 * Builds a CSV string from the currently visible contact list. Pure so it can be
 * unit-tested; the browser download is handled separately by `downloadContactsCsv`.
 */
export function buildContactsCsv(contacts: CrmContactWithProfile[]): string {
  const rows = contacts.map((contact) => [
    crmContactDisplayName(contact),
    contact.email ?? contact.profile?.email ?? "",
    contact.phone ?? "",
    CRM_SOURCE_LABEL[contact.source],
    CRM_STATUS_LABEL[contact.status],
    CRM_PRIORITY_LABEL[contact.priority],
    contactNeedsFollowUp(contact) ? "Yes" : "No",
    contact.last_contacted_at ?? "",
    contact.next_follow_up_at ?? "",
    contact.created_at,
  ])

  return [CSV_HEADERS, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")
}

export function downloadContactsCsv(contacts: CrmContactWithProfile[]): void {
  const csv = buildContactsCsv(contacts)
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  const stamp = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `reswell-crm-contacts-${stamp}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
