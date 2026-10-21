import type { SupabaseClient } from "@supabase/supabase-js"
import {
  NOTIFICATION_WINDOW_HOURS,
  type NotificationType,
} from "@/lib/services/notifications/catalog"
import {
  planPairKey,
  type DeliveredWindow,
  type DispatchLogDraft,
  type NotificationPlanSnapshot,
  type NotificationRowDraft,
  type PlannedDelivery,
} from "@/lib/services/notifications/plan"

const CHUNK = 80

interface DispatchLogRow {
  user_id: string
  type: string
  dedupe_key: string
  subject_key: string | null
  outcome: string
  rollup_key: string | null
  created_at: string
}

interface NotificationIdentityRow {
  user_id: string
  dedupe_key: string
  is_read: boolean | null
}

export async function loadNotificationPlanSnapshot(
  supabase: SupabaseClient,
  args: {
    now: Date
    userIds: string[]
    types: NotificationType[]
    dedupeKeys: string[]
    digestKeys: string[]
    preferenceUserIds: string[]
  },
): Promise<NotificationPlanSnapshot> {
  const since = new Date(args.now.getTime() - NOTIFICATION_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
  const [optOut, existingRows, windowLogs, identityLogs, digestedLogs] = await Promise.all([
    loadFollowOptOut(supabase, args.preferenceUserIds),
    loadExistingNotifications(supabase, args.userIds, [...args.dedupeKeys, ...args.digestKeys]),
    loadWindowLogs(supabase, args.userIds, args.types, since),
    loadIdentityLogs(supabase, args.userIds, args.dedupeKeys),
    loadDigestedLogs(supabase, args.userIds, args.digestKeys),
  ])

  const existing = new Map<string, { isRead: boolean }>()
  for (const row of existingRows) {
    if (!row.dedupe_key) continue
    existing.set(planPairKey(row.user_id, row.dedupe_key), { isRead: row.is_read === true })
  }

  const deliveredInWindow = new Map<string, DeliveredWindow>()
  for (const log of windowLogs) {
    if (log.outcome !== "delivered") continue
    const key = planPairKey(log.user_id, log.type)
    const window = deliveredInWindow.get(key) ?? { count: 0, keys: new Set<string>(), subjectCounts: new Map<string, number>() }
    window.count += 1
    window.keys.add(log.dedupe_key)
    if (log.subject_key) {
      window.subjectCounts.set(log.subject_key, (window.subjectCounts.get(log.subject_key) ?? 0) + 1)
    }
    deliveredInWindow.set(key, window)
  }

  const seenLogKeys = new Set<string>()
  for (const log of identityLogs) {
    seenLogKeys.add(planPairKey(log.user_id, log.dedupe_key))
  }

  const digestedCounts = new Map<string, number>()
  for (const log of digestedLogs) {
    if (!log.rollup_key) continue
    const key = planPairKey(log.user_id, log.rollup_key)
    digestedCounts.set(key, (digestedCounts.get(key) ?? 0) + 1)
  }

  return {
    now: args.now,
    followInAppOptOut: optOut,
    existing,
    seenLogKeys,
    deliveredInWindow,
    digestedCounts,
  }
}

export async function writePlannedNotifications(
  supabase: SupabaseClient,
  args: { rows: PlannedDelivery[]; logs: DispatchLogDraft[]; now: Date },
): Promise<void> {
  if (args.rows.length === 0 && args.logs.length === 0) return

  const writtenIds = new Map<string, string>()
  for (const chunk of chunks(args.rows, CHUNK)) {
    const payload = chunk.map((delivery) => notificationPayload(delivery.row, args.now))
    const { data, error } = await supabase
      .from("notifications")
      .upsert(payload, { onConflict: "user_id,dedupe_key" })
      .select("id, user_id, dedupe_key")
    if (error) {
      throw new Error(`notification upsert failed: ${error.message}`)
    }
    for (const row of (data ?? []) as Array<{ id: string; user_id: string; dedupe_key: string }>) {
      writtenIds.set(planPairKey(row.user_id, row.dedupe_key), row.id)
    }
  }

  if (args.logs.length === 0) return

  for (const chunk of chunks(args.logs, CHUNK)) {
    const payload = chunk.map((log) => ({
      user_id: log.userId,
      type: log.type,
      dedupe_key: log.dedupeKey,
      subject_key: log.subjectKey,
      outcome: log.outcome,
      rollup_key: log.rollupKey,
      notification_id: writtenIds.get(planPairKey(log.userId, log.rowDedupeKey)) ?? null,
      created_at: args.now.toISOString(),
    }))
    const { error } = await supabase
      .from("notification_dispatch_log")
      .upsert(payload, { onConflict: "user_id,dedupe_key" })
    if (error) {
      throw new Error(`notification dispatch log upsert failed: ${error.message}`)
    }
  }
}

function notificationPayload(row: NotificationRowDraft, now: Date) {
  return {
    user_id: row.userId,
    type: row.type,
    listing_id: row.listingId,
    actor_id: row.actorId,
    message: row.body,
    title: row.title,
    body: row.body,
    href: row.href,
    dedupe_key: row.dedupeKey,
    metadata: row.metadata,
    is_read: false,
    created_at: now.toISOString(),
  }
}

async function loadFollowOptOut(supabase: SupabaseClient, userIds: string[]): Promise<Set<string>> {
  const optOut = new Set<string>()
  if (userIds.length === 0) return optOut
  for (const ids of chunks(unique(userIds), CHUNK)) {
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("user_id, follow_in_app")
      .in("user_id", ids)
    if (error) throw new Error(`notification preferences read failed: ${error.message}`)
    for (const row of (data ?? []) as Array<{ user_id: string; follow_in_app: boolean | null }>) {
      if (row.follow_in_app === false) optOut.add(row.user_id)
    }
  }
  return optOut
}

async function loadExistingNotifications(
  supabase: SupabaseClient,
  userIds: string[],
  dedupeKeys: string[],
): Promise<NotificationIdentityRow[]> {
  if (userIds.length === 0 || dedupeKeys.length === 0) return []
  const rows: NotificationIdentityRow[] = []
  for (const ids of chunks(unique(userIds), CHUNK)) {
    for (const keys of chunks(unique(dedupeKeys), CHUNK)) {
      const { data, error } = await supabase
        .from("notifications")
        .select("user_id, dedupe_key, is_read")
        .in("user_id", ids)
        .in("dedupe_key", keys)
      if (error) throw new Error(`notification identity read failed: ${error.message}`)
      rows.push(...((data ?? []) as NotificationIdentityRow[]))
    }
  }
  return rows
}

async function loadWindowLogs(
  supabase: SupabaseClient,
  userIds: string[],
  types: NotificationType[],
  since: string,
): Promise<DispatchLogRow[]> {
  if (userIds.length === 0 || types.length === 0) return []
  const rows: DispatchLogRow[] = []
  for (const ids of chunks(unique(userIds), CHUNK)) {
    const { data, error } = await supabase
      .from("notification_dispatch_log")
      .select("user_id, type, dedupe_key, subject_key, outcome, rollup_key, created_at")
      .in("user_id", ids)
      .in("type", types)
      .eq("outcome", "delivered")
      .gte("created_at", since)
    if (error) throw new Error(`notification window read failed: ${error.message}`)
    rows.push(...((data ?? []) as DispatchLogRow[]))
  }
  return rows
}

async function loadIdentityLogs(
  supabase: SupabaseClient,
  userIds: string[],
  dedupeKeys: string[],
): Promise<DispatchLogRow[]> {
  if (userIds.length === 0 || dedupeKeys.length === 0) return []
  const rows: DispatchLogRow[] = []
  for (const ids of chunks(unique(userIds), CHUNK)) {
    for (const keys of chunks(unique(dedupeKeys), CHUNK)) {
      const { data, error } = await supabase
        .from("notification_dispatch_log")
        .select("user_id, type, dedupe_key, subject_key, outcome, rollup_key, created_at")
        .in("user_id", ids)
        .in("dedupe_key", keys)
      if (error) throw new Error(`notification dedupe read failed: ${error.message}`)
      rows.push(...((data ?? []) as DispatchLogRow[]))
    }
  }
  return rows
}

async function loadDigestedLogs(
  supabase: SupabaseClient,
  userIds: string[],
  digestKeys: string[],
): Promise<DispatchLogRow[]> {
  if (userIds.length === 0 || digestKeys.length === 0) return []
  const rows: DispatchLogRow[] = []
  for (const ids of chunks(unique(userIds), CHUNK)) {
    for (const keys of chunks(unique(digestKeys), CHUNK)) {
      const page = await selectAll<DispatchLogRow>((from, to) =>
        supabase
          .from("notification_dispatch_log")
          .select("user_id, type, dedupe_key, subject_key, outcome, rollup_key, created_at")
          .in("user_id", ids)
          .in("rollup_key", keys)
          .eq("outcome", "digested")
          .order("id", { ascending: true })
          .range(from, to),
      )
      rows.push(...page)
    }
  }
  return rows
}

async function selectAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const pageSize = 1000
  const rows: T[] = []
  for (let from = 0; from < 20_000; from += pageSize) {
    const { data, error } = await query(from, from + pageSize - 1)
    if (error) throw new Error(`notification digest read failed: ${error.message}`)
    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))]
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}
