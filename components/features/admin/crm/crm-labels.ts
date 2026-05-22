import type {
  CrmBoardInterestStatus,
  CrmContactPriority,
  CrmContactSource,
  CrmContactStatus,
  CrmInteractionType,
} from "@/lib/db/crm"

export const CRM_STATUS_LABEL: Record<CrmContactStatus, string> = {
  lead: "Lead",
  prospect: "Prospect",
  active: "Active",
  customer: "Customer",
  inactive: "Inactive",
}

export const CRM_PRIORITY_LABEL: Record<CrmContactPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
}

export const CRM_SOURCE_LABEL: Record<CrmContactSource, string> = {
  profile: "Reswell user",
  external: "External",
}

export const CRM_INTEREST_STATUS_LABEL: Record<CrmBoardInterestStatus, string> = {
  interested: "Interested",
  contacted: "Contacted",
  matched: "Matched",
  fulfilled: "Fulfilled",
  lost: "Lost",
}

export const CRM_INTERACTION_LABEL: Record<CrmInteractionType, string> = {
  call: "Phone call",
  email: "Email",
  text: "Text / SMS",
  in_person: "In person",
  note: "Internal note",
  other: "Other",
}

export function crmStatusBadgeClass(status: CrmContactStatus): string {
  switch (status) {
    case "lead":
      return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200"
    case "prospect":
      return "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200"
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
    case "customer":
      return "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-200"
    case "inactive":
      return "border-muted bg-muted/50 text-muted-foreground"
    default:
      return ""
  }
}

export function crmPriorityBadgeClass(priority: CrmContactPriority): string {
  switch (priority) {
    case "high":
      return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
    case "low":
      return "border-muted bg-muted/40 text-muted-foreground"
    default:
      return ""
  }
}

export function crmInterestStatusBadgeClass(status: CrmBoardInterestStatus): string {
  switch (status) {
    case "interested":
      return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200"
    case "contacted":
      return "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200"
    case "matched":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
    case "fulfilled":
      return "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-200"
    case "lost":
      return "border-muted bg-muted/50 text-muted-foreground"
    default:
      return ""
  }
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    value,
  )
}

export function contactNeedsFollowUp(
  contact: { next_follow_up_at: string | null; last_contacted_at: string | null },
  now = Date.now(),
): boolean {
  if (contact.next_follow_up_at && new Date(contact.next_follow_up_at).getTime() <= now) return true
  if (!contact.last_contacted_at) return true
  return false
}
