import type {
  ContactMessageRow,
  ContactMessageSource,
  ContactMessageSupportStatus,
} from "@/lib/db/contactMessages"

const DAY_MS = 24 * 60 * 60 * 1000

export type ContactMessagesStats = {
  total: number
  /** new + triaged + ticket_created */
  open: number
  /** new + triaged — needs a first/next human touch */
  awaitingReply: number
  inProgress: number
  resolved: number
  /** Tickets created in the last 7 days. */
  newThisWeek: number
  statusCounts: Record<ContactMessageSupportStatus, number>
  channelCounts: Record<ContactMessageSource, number>
  /** Tickets with a linked in-app support thread. */
  linkedThreads: number
  /** resolved / total, 0–100. */
  resolutionRate: number
  /** Mean hours between created_at and updated_at for resolved tickets, or null. */
  avgResolutionHours: number | null
  /** Ticket volume per day for the trailing window (oldest → newest). */
  dailySeries: { date: string; count: number }[]
}

function emptyStatusCounts(): Record<ContactMessageSupportStatus, number> {
  return { new: 0, triaged: 0, ticket_created: 0, resolved: 0 }
}

/**
 * Pure, client-side derivation of inbox KPIs from the loaded ticket list.
 * Keeps the admin client lean and is trivially unit-testable.
 */
export function computeContactMessagesStats(
  rows: ContactMessageRow[],
  windowDays = 14,
): ContactMessagesStats {
  const statusCounts = emptyStatusCounts()
  const channelCounts: Record<ContactMessageSource, number> = {
    contact_form: 0,
    messages_support: 0,
  }

  const now = Date.now()
  const weekAgo = now - 7 * DAY_MS
  let linkedThreads = 0
  let newThisWeek = 0
  let resolutionHoursSum = 0
  let resolutionSamples = 0

  const seriesBuckets = new Map<string, number>()
  for (let i = windowDays - 1; i >= 0; i--) {
    const key = new Date(now - i * DAY_MS).toISOString().slice(0, 10)
    seriesBuckets.set(key, 0)
  }

  for (const row of rows) {
    statusCounts[row.support_status] += 1
    channelCounts[row.source] += 1
    if (row.support_conversation_id) linkedThreads += 1

    const createdMs = new Date(row.created_at).getTime()
    if (!Number.isNaN(createdMs)) {
      if (createdMs >= weekAgo) newThisWeek += 1
      const dayKey = new Date(createdMs).toISOString().slice(0, 10)
      if (seriesBuckets.has(dayKey)) {
        seriesBuckets.set(dayKey, (seriesBuckets.get(dayKey) ?? 0) + 1)
      }
    }

    if (row.support_status === "resolved") {
      const updatedMs = new Date(row.updated_at).getTime()
      if (!Number.isNaN(createdMs) && !Number.isNaN(updatedMs) && updatedMs > createdMs) {
        resolutionHoursSum += (updatedMs - createdMs) / (60 * 60 * 1000)
        resolutionSamples += 1
      }
    }
  }

  const total = rows.length
  const awaitingReply = statusCounts.new + statusCounts.triaged
  const open = awaitingReply + statusCounts.ticket_created

  return {
    total,
    open,
    awaitingReply,
    inProgress: statusCounts.ticket_created,
    resolved: statusCounts.resolved,
    newThisWeek,
    statusCounts,
    channelCounts,
    linkedThreads,
    resolutionRate: total > 0 ? Math.round((statusCounts.resolved / total) * 100) : 0,
    avgResolutionHours:
      resolutionSamples > 0 ? Math.round((resolutionHoursSum / resolutionSamples) * 10) / 10 : null,
    dailySeries: Array.from(seriesBuckets, ([date, count]) => ({ date, count })),
  }
}

/** Human-friendly duration for the avg-resolution KPI. */
export function formatResolutionDuration(hours: number | null): string {
  if (hours == null) return "—"
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`
  if (hours < 48) return `${Math.round(hours)}h`
  return `${Math.round(hours / 24)}d`
}
