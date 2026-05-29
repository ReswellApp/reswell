import type {
  CrmBoardInterestStatus,
  CrmContactPriority,
  CrmContactSource,
  CrmContactStatus,
  CrmInteractionType,
  CrmTagColor,
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

export const CRM_TAG_COLOR_OPTIONS: CrmTagColor[] = [
  "slate",
  "teal",
  "sky",
  "violet",
  "amber",
  "rose",
  "emerald",
  "indigo",
  "orange",
  "pink",
]

const CRM_TAG_COLOR_CLASS: Record<CrmTagColor, string> = {
  slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200",
  teal: "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-200",
  sky: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200",
  violet: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200",
  amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200",
  emerald:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
  orange: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200",
  pink: "border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-900 dark:bg-pink-950 dark:text-pink-200",
}

const CRM_TAG_DOT_CLASS: Record<CrmTagColor, string> = {
  slate: "bg-slate-400",
  teal: "bg-teal-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  emerald: "bg-emerald-500",
  indigo: "bg-indigo-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
}

export function crmTagBadgeClass(color: CrmTagColor): string {
  return CRM_TAG_COLOR_CLASS[color] ?? CRM_TAG_COLOR_CLASS.slate
}

export function crmTagDotClass(color: CrmTagColor): string {
  return CRM_TAG_DOT_CLASS[color] ?? CRM_TAG_DOT_CLASS.slate
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
