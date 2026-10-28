import type { SupabaseClient } from "@supabase/supabase-js"
import { loadNotificationPlanSnapshot, writePlannedNotifications } from "@/lib/db/notifications"
import { listingDetailHref } from "@/lib/listing-href"
import {
  NOTIFICATION_POLICIES,
  PAYOUT_INFO_HREF,
  listingSavedBody,
  listingSavedDedupeKey,
  listingSavedDigestDedupeKey,
  newListingDigestDedupeKey,
  notificationDayKey,
  offerDedupeKey,
  offerNotificationTitle,
  payoutInfoDedupeKey,
  type OfferNotificationType,
} from "@/lib/services/notifications/catalog"
import {
  collapsePlannedDeliveries,
  planInAppNotifications,
  type InAppNotificationInput,
  type PlannedNotification,
} from "@/lib/services/notifications/plan"
import { schedulePushForPlannedDeliveries } from "@/lib/services/push"
import { createServiceRoleClient } from "@/lib/supabase/server"

export interface PublishInAppSummary {
  delivered: number
  digested: number
  skipped: number
}

export async function publishInAppNotifications(
  supabase: SupabaseClient,
  inputs: InAppNotificationInput[],
  now: Date = new Date(),
): Promise<PublishInAppSummary> {
  const valid = inputs.filter((input) => input.userId.trim() && input.dedupeKey.trim())
  if (valid.length === 0) return { delivered: 0, digested: 0, skipped: inputs.length }

  const day = notificationDayKey(now)
  const userIds = unique(valid.map((input) => input.userId))
  const types = unique(valid.map((input) => input.type))
  const dedupeKeys = unique(valid.map((input) => input.dedupeKey))
  const digestKeys = digestKeysFor(valid, day)
  const preferenceUserIds = unique(
    valid
      .filter((input) => NOTIFICATION_POLICIES[input.type].preference === "follow_in_app")
      .map((input) => input.userId),
  )

  const snapshot = await loadNotificationPlanSnapshot(supabase, {
    now,
    userIds,
    types,
    dedupeKeys,
    digestKeys,
    preferenceUserIds,
  })
  const planned = planInAppNotifications(valid, snapshot)
  const collapsed = collapsePlannedDeliveries(planned)
  await writePlannedNotifications(supabase, { ...collapsed, now })
  schedulePushForPlannedDeliveries(collapsed.rows)
  return summarize(planned, inputs.length - valid.length)
}

export async function publishListingSaved(input: {
  ownerId: string
  actorId: string
  listingId: string
  listingTitle: string
  listingSlug?: string | null
}): Promise<void> {
  if (!input.ownerId || input.ownerId === input.actorId) return
  try {
    const supabase = createServiceRoleClient()
    const now = new Date()
    await publishInAppNotifications(supabase, [
      {
        userId: input.ownerId,
        type: "listing_saved",
        actorId: input.actorId,
        listingId: input.listingId,
        title: "Someone saved your listing",
        body: listingSavedBody(input.listingTitle),
        href: listingDetailHref({ id: input.listingId, slug: input.listingSlug }),
        dedupeKey: listingSavedDedupeKey(input.listingId, input.actorId, notificationDayKey(now)),
        metadata: { listingId: input.listingId, actorId: input.actorId },
      },
    ], now)
  } catch (error) {
    console.error(
      "[notifications] listing_saved:",
      error instanceof Error ? error.message : error,
    )
  }
}

export async function publishOfferNotification(
  supabase: SupabaseClient,
  input: {
    recipientId: string
    actorId: string
    listingId: string
    offerId: string
    type: OfferNotificationType
    message: string
    amountUsd?: number
  },
): Promise<void> {
  try {
    await publishInAppNotifications(supabase, [
      {
        userId: input.recipientId,
        type: input.type,
        actorId: input.actorId,
        listingId: input.listingId,
        title: offerNotificationTitle(input.type),
        body: input.message,
        href: listingDetailHref({ id: input.listingId }),
        dedupeKey: offerDedupeKey(input.type, input.offerId, input.amountUsd),
        subjectKey: input.offerId,
        metadata: {
          offerId: input.offerId,
          ...(input.amountUsd != null ? { amountUsd: input.amountUsd } : {}),
        },
      },
    ])
  } catch (error) {
    console.error(
      "[notifications] offer:",
      error instanceof Error ? error.message : error,
    )
  }
}

export async function publishPayoutInfoRequired(
  supabase: SupabaseClient,
  input: { userId: string; fingerprint: string; message: string },
): Promise<boolean> {
  const fingerprint = input.fingerprint.trim()
  if (!input.userId || !fingerprint) return false
  try {
    await publishInAppNotifications(supabase, [
      {
        userId: input.userId,
        type: "payout_info_required",
        title: "Payout details needed",
        body: input.message,
        href: PAYOUT_INFO_HREF,
        dedupeKey: payoutInfoDedupeKey(fingerprint),
        metadata: { fingerprint },
      },
    ])
    return true
  } catch (error) {
    console.error(
      "[notifications] payout_info_required:",
      error instanceof Error ? error.message : error,
    )
    return false
  }
}

function digestKeysFor(inputs: InAppNotificationInput[], day: string): string[] {
  const keys = new Set<string>()
  for (const input of inputs) {
    if (input.type === "listing_saved") keys.add(listingSavedDigestDedupeKey(day))
    if (input.type === "new_listing_from_followed" && input.subjectKey?.trim()) {
      keys.add(newListingDigestDedupeKey(input.subjectKey.trim(), day))
    }
  }
  return [...keys]
}

function summarize(planned: PlannedNotification[], invalid: number): PublishInAppSummary {
  let delivered = 0
  let digested = 0
  let skipped = invalid
  for (const item of planned) {
    if (item.action === "skip") {
      skipped += 1
      continue
    }
    if (item.logOutcome === "digested") digested += 1
    else delivered += 1
  }
  return { delivered, digested, skipped }
}

function unique<T extends string>(values: T[]): T[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))] as T[]
}
