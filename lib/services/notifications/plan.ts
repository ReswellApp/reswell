import {
  LISTING_SAVED_DIGEST_HREF,
  NEW_LISTING_DIGEST_HREF,
  NOTIFICATION_POLICIES,
  isNotificationType,
  listingSavedDigestBody,
  listingSavedDigestDedupeKey,
  newListingDigestBody,
  newListingDigestDedupeKey,
  notificationDayKey,
  type NotificationType,
} from "@/lib/services/notifications/catalog"

export interface InAppNotificationInput {
  userId: string
  type: NotificationType
  actorId?: string | null
  listingId?: string | null
  title: string
  body: string
  href?: string | null
  dedupeKey: string
  subjectKey?: string | null
  metadata?: Record<string, unknown>
  digestActorName?: string | null
}

export interface ExistingNotificationRow {
  isRead: boolean
}

export interface DeliveredWindow {
  count: number
  keys: Set<string>
  subjectCounts: Map<string, number>
}

export interface NotificationPlanSnapshot {
  now: Date
  followInAppOptOut: Set<string>
  /** userId + dedupe key of a notification row that already exists. */
  existing: Map<string, ExistingNotificationRow>
  /** userId + dedupe key of any dispatch log, including digested events. */
  seenLogKeys: Set<string>
  /** Delivered rows inside the rolling window, keyed by userId + primary type. */
  deliveredInWindow: Map<string, DeliveredWindow>
  /** Digested events already logged, keyed by userId + digest dedupe key. */
  digestedCounts: Map<string, number>
}

export type PlanSkipReason = "self" | "preference" | "duplicate" | "cap" | "invalid"

export interface NotificationRowDraft {
  userId: string
  type: NotificationType
  actorId: string | null
  listingId: string | null
  title: string
  body: string
  href: string | null
  dedupeKey: string
  metadata: Record<string, unknown>
}

export interface PlannedDelivery {
  action: "deliver"
  row: NotificationRowDraft
  recordLog: boolean
  logOutcome: "delivered" | "digested"
  logType: NotificationType
  logDedupeKey: string
  subjectKey: string | null
  rollupKey: string | null
}

export interface PlannedSkip {
  action: "skip"
  reason: PlanSkipReason
  userId: string
  type: NotificationType
  dedupeKey: string
}

export type PlannedNotification = PlannedDelivery | PlannedSkip

export interface DispatchLogDraft {
  userId: string
  type: NotificationType
  dedupeKey: string
  subjectKey: string | null
  outcome: "delivered" | "digested"
  rollupKey: string | null
  rowDedupeKey: string
}

export function planPairKey(userId: string, key: string): string {
  return `${userId}\n${key}`
}

export function planInAppNotifications(
  inputs: InAppNotificationInput[],
  snapshot: NotificationPlanSnapshot,
): PlannedNotification[] {
  const seen = new Set(snapshot.seenLogKeys)
  const windows = cloneWindows(snapshot.deliveredInWindow)
  const digested = new Map(snapshot.digestedCounts)
  const planned: PlannedNotification[] = []

  for (const input of inputs) {
    planned.push(planOne(input, snapshot, seen, windows, digested))
  }

  return planned
}

/**
 * Several overflows in one batch update the same digest row. Keep the last
 * copy of that row and every log, so the stored count matches the batch.
 */
export function collapsePlannedDeliveries(planned: PlannedNotification[]): {
  rows: PlannedDelivery[]
  logs: DispatchLogDraft[]
} {
  const rows = new Map<string, PlannedDelivery>()
  const logs: DispatchLogDraft[] = []

  for (const item of planned) {
    if (item.action !== "deliver") continue
    rows.set(planPairKey(item.row.userId, item.row.dedupeKey), item)
    if (!item.recordLog) continue
    logs.push({
      userId: item.row.userId,
      type: item.logType,
      dedupeKey: item.logDedupeKey,
      subjectKey: item.subjectKey,
      outcome: item.logOutcome,
      rollupKey: item.rollupKey,
      rowDedupeKey: item.row.dedupeKey,
    })
  }

  return { rows: [...rows.values()], logs }
}

function planOne(
  input: InAppNotificationInput,
  snapshot: NotificationPlanSnapshot,
  seen: Set<string>,
  windows: Map<string, DeliveredWindow>,
  digested: Map<string, number>,
): PlannedNotification {
  const userId = input.userId.trim()
  const dedupeKey = input.dedupeKey.trim()
  if (!userId || !dedupeKey || !isNotificationType(input.type)) {
    return skip("invalid", input)
  }

  const policy = NOTIFICATION_POLICIES[input.type]
  if (input.type.endsWith("_digest")) return skip("invalid", input)

  const actorId = cleanId(input.actorId)
  if (actorId && actorId === userId) return skip("self", input)

  if (policy.preference === "follow_in_app" && snapshot.followInAppOptOut.has(userId)) {
    return skip("preference", input)
  }

  const identity = planPairKey(userId, dedupeKey)
  const existing = snapshot.existing.get(identity)
  const window = windowFor(windows, userId, input.type)

  if (policy.mode === "once") {
    if (seen.has(identity) || existing) return skip("duplicate", input)
    seen.add(identity)
    return deliverPrimary(input, actorId, "delivered", null)
  }

  if (policy.mode === "upsert_unread") {
    const inWindow = window.keys.has(dedupeKey)
    if (inWindow || (existing && !existing.isRead)) {
      return deliverPrimary(input, actorId, "delivered", null, false)
    }
    if (policy.maxPerWindow != null && window.count >= policy.maxPerWindow) {
      return skip("cap", input)
    }
    window.count += 1
    window.keys.add(dedupeKey)
    return deliverPrimary(input, actorId, "delivered", null, true)
  }

  if (seen.has(identity) || existing) return skip("duplicate", input)

  const subjectKey = cleanId(input.subjectKey)
  const subjectCount = subjectKey ? (window.subjectCounts.get(subjectKey) ?? 0) : 0
  const overSubject =
    policy.maxPerSubjectWindow != null &&
    subjectKey != null &&
    subjectCount >= policy.maxPerSubjectWindow
  const overWindow = policy.maxPerWindow != null && window.count >= policy.maxPerWindow

  if (overSubject || overWindow) {
    if (!policy.digestType) return skip("cap", input)
    seen.add(identity)
    return deliverDigest(input, actorId, subjectKey, policy.digestType, snapshot.now, digested)
  }

  window.count += 1
  window.keys.add(dedupeKey)
  if (subjectKey) window.subjectCounts.set(subjectKey, subjectCount + 1)
  seen.add(identity)
  return deliverPrimary(input, actorId, "delivered", null, true)
}

function deliverDigest(
  input: InAppNotificationInput,
  actorId: string | null,
  subjectKey: string | null,
  digestType: NotificationType,
  now: Date,
  digested: Map<string, number>,
): PlannedDelivery {
  const day = notificationDayKey(now)
  const rollupKey =
    digestType === "new_listing_from_followed_digest" && subjectKey
      ? newListingDigestDedupeKey(subjectKey, day)
      : listingSavedDigestDedupeKey(day)
  const countKey = planPairKey(input.userId, rollupKey)
  const count = (digested.get(countKey) ?? 0) + 1
  digested.set(countKey, count)

  const shopName = input.digestActorName?.trim() || "A seller"
  const isFollowDigest = digestType === "new_listing_from_followed_digest"
  const row: NotificationRowDraft = {
    userId: input.userId,
    type: digestType,
    actorId: isFollowDigest ? subjectKey : null,
    listingId: null,
    title: isFollowDigest ? `${shopName} posted more listings` : "More people saved your listings",
    body: isFollowDigest ? newListingDigestBody(shopName, count) : listingSavedDigestBody(count),
    href: isFollowDigest ? NEW_LISTING_DIGEST_HREF : LISTING_SAVED_DIGEST_HREF,
    dedupeKey: rollupKey,
    metadata: { count, day },
  }

  return {
    action: "deliver",
    row,
    recordLog: true,
    logOutcome: "digested",
    logType: input.type,
    logDedupeKey: input.dedupeKey,
    subjectKey,
    rollupKey,
  }
}

function deliverPrimary(
  input: InAppNotificationInput,
  actorId: string | null,
  outcome: "delivered",
  rollupKey: null,
  recordLog = true,
): PlannedDelivery {
  return {
    action: "deliver",
    row: {
      userId: input.userId,
      type: input.type,
      actorId,
      listingId: cleanId(input.listingId),
      title: input.title.trim() || input.body.trim(),
      body: input.body,
      href: cleanHref(input.href),
      dedupeKey: input.dedupeKey,
      metadata: input.metadata ?? {},
    },
    recordLog,
    logOutcome: outcome,
    logType: input.type,
    logDedupeKey: input.dedupeKey,
    subjectKey: cleanId(input.subjectKey),
    rollupKey,
  }
}

function skip(reason: PlanSkipReason, input: InAppNotificationInput): PlannedSkip {
  return {
    action: "skip",
    reason,
    userId: input.userId,
    type: input.type,
    dedupeKey: input.dedupeKey,
  }
}

function windowFor(
  windows: Map<string, DeliveredWindow>,
  userId: string,
  type: NotificationType,
): DeliveredWindow {
  const key = planPairKey(userId, type)
  const existing = windows.get(key)
  if (existing) return existing
  const created: DeliveredWindow = { count: 0, keys: new Set(), subjectCounts: new Map() }
  windows.set(key, created)
  return created
}

function cloneWindows(source: Map<string, DeliveredWindow>): Map<string, DeliveredWindow> {
  const copy = new Map<string, DeliveredWindow>()
  for (const [key, window] of source) {
    copy.set(key, {
      count: window.count,
      keys: new Set(window.keys),
      subjectCounts: new Map(window.subjectCounts),
    })
  }
  return copy
}

function cleanId(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function cleanHref(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) return null
  return trimmed
}
