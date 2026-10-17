import type { CrmContactStatus } from "@/lib/db/crm"

const CLOSED_STATUSES = new Set<CrmContactStatus>(["customer", "inactive"])
const STALE_WITHOUT_DATE_MS = 7 * 86_400_000

export type CrmCircleBackContact = {
  status: CrmContactStatus
  next_follow_up_at: string | null
  last_contacted_at: string | null
  profile_id: string | null
}

export type CrmReswellActivity = {
  listedSurfboard: boolean
  bought: boolean
}

export const CRM_NO_RESWELL_ACTIVITY: CrmReswellActivity = {
  listedSurfboard: false,
  bought: false,
}

export function contactConvertedOnReswell(activity: CrmReswellActivity): boolean {
  return activity.listedSurfboard || activity.bought
}

export const CRM_FOLLOW_UP_TEMPLATE_DEFAULT =
  "Hey {name}, circling back in case you are still looking for a board. Happy to help if you want to list or buy one."

export function followUpGreetingName(displayName: string): string {
  const first = displayName.trim().split(/\s+/)[0]
  if (!first || first.toLowerCase() === "facebook") return "there"
  return first
}

export function renderFollowUpMessage(template: string, name: string): string {
  return template.replaceAll("{name}", name)
}

/**
 * Due for a Marketplace-style check-in: follow-up date has arrived (or they
 * have gone quiet), they are still an open lead, and they have not listed a
 * surfboard or bought on Reswell.
 */
export function contactCircleBackDue(
  contact: CrmCircleBackContact,
  activity: CrmReswellActivity,
  now = Date.now(),
): boolean {
  if (CLOSED_STATUSES.has(contact.status)) return false
  if (contactConvertedOnReswell(activity)) return false

  if (contact.next_follow_up_at) {
    const due = new Date(contact.next_follow_up_at).getTime()
    return Number.isFinite(due) && due <= now
  }

  if (!contact.last_contacted_at) return true
  const last = new Date(contact.last_contacted_at).getTime()
  if (!Number.isFinite(last)) return true
  return now - last >= STALE_WITHOUT_DATE_MS
}
