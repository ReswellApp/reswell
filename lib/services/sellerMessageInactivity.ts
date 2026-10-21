import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchListingsEligibleForSellerMessageInactivity,
  recordSellerMessageInactivityAction,
  recordSellerMessageReminder,
  SELLER_MESSAGE_REMINDER_DAYS,
  type SellerMessageInactivityEligibleRow,
  type SellerMessageReminderStage,
} from "@/lib/db/sellerMessageInactivity"
import type { KlaviyoListingImage } from "@/lib/klaviyo/catalog-product"
import {
  trackKlaviyoInactiveSeller,
  type KlaviyoInactiveSellerMissedMessage,
} from "@/lib/klaviyo/track-inactive-seller"
import { trackKlaviyoSellerMessageReminder } from "@/lib/klaviyo/track-seller-message-reminder"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import {
  sellerListingAutoHiddenBody,
  sellerListingAutoHiddenDedupeKey,
  sellerListingAutoHiddenTitle,
  sellerListingHideWarningBody,
  sellerListingHideWarningDedupeKey,
  sellerListingHideWarningTitle,
  sellerMessageWaitingBody,
  sellerMessageWaitingDedupeKey,
  sellerMessageWaitingTitle,
} from "@/lib/services/notifications/catalog"
import { publishInAppNotifications } from "@/lib/services/notifications/publish"
import type { InAppNotificationInput } from "@/lib/services/notifications/plan"
import {
  resolveSellerMessageReminderStage,
  sellerMessageReminderCutoff,
  sellerMessageReminderMessageKey,
} from "@/lib/services/sellerMessageInactivityStage"
import { setListingVacationModeForSeller } from "@/lib/services/listingVacationMode"

export type ProcessSellerMessageInactivitySummary = {
  eligible: number
  listingsProcessed: number
  remindersSent: number
  warningsSent: number
  vacationApplied: number
  inAppNotified: number
  klaviyoEmitted: number
  failed: number
  errors: string[]
}

type DueRow = SellerMessageInactivityEligibleRow & { stage: SellerMessageReminderStage }

type ListingInactivityGroup = {
  listingId: string
  sellerId: string
  listingTitle: string
  listingSlug: string | null
  listingSection: string
  stage: SellerMessageReminderStage
  rows: DueRow[]
}

const STAGE_ORDER: Record<SellerMessageReminderStage, number> = {
  day7: 0,
  day6: 1,
  day3: 2,
}

function groupDueRows(rows: DueRow[]): ListingInactivityGroup[] {
  const byListing = new Map<string, ListingInactivityGroup>()

  for (const row of rows) {
    const key = `${row.listing_id}:${row.stage}`
    const existing = byListing.get(key)
    if (existing) {
      existing.rows.push(row)
      continue
    }
    byListing.set(key, {
      listingId: row.listing_id,
      sellerId: row.seller_id,
      listingTitle: row.listing_title,
      listingSlug: row.listing_slug,
      listingSection: row.listing_section,
      stage: row.stage,
      rows: [row],
    })
  }

  return [...byListing.values()].sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage])
}

function buildMissedMessages(
  rows: SellerMessageInactivityEligibleRow[],
): KlaviyoInactiveSellerMissedMessage[] {
  const origin = publicSiteOriginForEmail().replace(/\/$/, "")
  return rows.map((row) => ({
    conversation_id: row.conversation_id,
    message_id: row.buyer_message_id,
    buyer_user_id: row.buyer_id,
    buyer_message_at: row.buyer_message_at,
    message: row.buyer_message_content,
    messages_url: `${origin}/messages/${row.conversation_id}`,
  }))
}

function oldestConversationId(rows: SellerMessageInactivityEligibleRow[]): string {
  const oldest = [...rows].sort((a, b) => a.buyer_message_at.localeCompare(b.buyer_message_at))[0]
  return oldest?.conversation_id ?? ""
}

function inAppNotice(group: ListingInactivityGroup): InAppNotificationInput | null {
  const messageKey = sellerMessageReminderMessageKey(group.rows.map((row) => row.buyer_message_id))
  const conversationId = oldestConversationId(group.rows)
  if (!messageKey || !conversationId) return null

  const href = `/messages/${conversationId}`
  const title = group.listingTitle
  const metadata = {
    listingId: group.listingId,
    conversationId,
    stage: group.stage,
    messageIds: group.rows.map((row) => row.buyer_message_id),
  }

  if (group.stage === "day3") {
    return {
      userId: group.sellerId,
      type: "seller_message_waiting",
      listingId: group.listingId,
      title: sellerMessageWaitingTitle(),
      body: sellerMessageWaitingBody(title),
      href,
      dedupeKey: sellerMessageWaitingDedupeKey(group.listingId, messageKey),
      metadata,
    }
  }
  if (group.stage === "day6") {
    return {
      userId: group.sellerId,
      type: "seller_listing_hide_warning",
      listingId: group.listingId,
      title: sellerListingHideWarningTitle(),
      body: sellerListingHideWarningBody(title),
      href,
      dedupeKey: sellerListingHideWarningDedupeKey(group.listingId, messageKey),
      metadata,
    }
  }
  return {
    userId: group.sellerId,
    type: "seller_listing_auto_hidden",
    listingId: group.listingId,
    title: sellerListingAutoHiddenTitle(),
    body: sellerListingAutoHiddenBody(title),
    href,
    dedupeKey: sellerListingAutoHiddenDedupeKey(group.listingId, messageKey),
    metadata,
  }
}

async function fetchListingImagesForKlaviyo(
  supabase: SupabaseClient,
  listingId: string,
): Promise<KlaviyoListingImage[] | null> {
  const { data, error } = await supabase
    .from("listings")
    .select("tile_gallery_images")
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data) return null
  const images = (data as { tile_gallery_images?: KlaviyoListingImage[] | null }).tile_gallery_images
  return Array.isArray(images) ? images : null
}

async function fetchSellerDisplayName(
  supabase: SupabaseClient,
  sellerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name, shop_name, is_shop")
    .eq("id", sellerId)
    .maybeSingle()

  if (!data) return null
  const shop = typeof data.shop_name === "string" ? data.shop_name.trim() : ""
  if (data.is_shop && shop) return shop
  const dn = typeof data.display_name === "string" ? data.display_name.trim() : ""
  return dn || null
}

async function publishNotice(
  supabase: SupabaseClient,
  group: ListingInactivityGroup,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const notice = inAppNotice(group)
  if (!notice) return { ok: false, error: "missing conversation" }
  try {
    await publishInAppNotifications(supabase, [notice])
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Unanswered buyer messages on a live listing:
 * day 3 — in-app "are you still here?" and Klaviyo **Seller Still Here**
 * day 6 — in-app hide warning and Klaviyo **Seller Listing Hide Warning**
 * day 7 — vacation mode, in-app notice, and Klaviyo **Inactive Seller**
 *          (vacation mode also emits **Listing Auto Vacation**)
 */
export async function processSellerMessageInactivity(
  supabase: SupabaseClient,
  referenceTime: Date = new Date(),
): Promise<ProcessSellerMessageInactivitySummary> {
  const cutoff = sellerMessageReminderCutoff(referenceTime, SELLER_MESSAGE_REMINDER_DAYS)

  const { data: eligibleRows, error: fetchErr } =
    await fetchListingsEligibleForSellerMessageInactivity(supabase, cutoff)

  if (fetchErr) {
    return {
      eligible: 0,
      listingsProcessed: 0,
      remindersSent: 0,
      warningsSent: 0,
      vacationApplied: 0,
      inAppNotified: 0,
      klaviyoEmitted: 0,
      failed: 0,
      errors: [fetchErr],
    }
  }

  const dueRows: DueRow[] = []
  for (const row of eligibleRows) {
    const stage = resolveSellerMessageReminderStage({
      buyerMessageAt: new Date(row.buyer_message_at),
      referenceTime,
      reminder3dAt: row.reminder_3d_at,
      warning6dAt: row.warning_6d_at,
      vacationAppliedAt: row.vacation_applied_at,
    })
    if (stage) dueRows.push({ ...row, stage })
  }

  const groups = groupDueRows(dueRows)
  const errors: string[] = []
  const hiddenListingIds = new Set<string>()
  let remindersSent = 0
  let warningsSent = 0
  let vacationApplied = 0
  let inAppNotified = 0
  let klaviyoEmitted = 0
  let failed = 0

  for (const group of groups) {
    if (group.stage !== "day7" && hiddenListingIds.has(group.listingId)) {
      continue
    }

    if (group.stage === "day7") {
      const outcome = await processDay7(supabase, group)
      if (outcome.vacationApplied) {
        vacationApplied += 1
        hiddenListingIds.add(group.listingId)
      }
      if (outcome.inApp) inAppNotified += 1
      if (outcome.klaviyo) klaviyoEmitted += 1
      failed += outcome.failed
      errors.push(...outcome.errors)
      continue
    }

    const outcome = await processReminder(supabase, group)
    if (outcome.sent && group.stage === "day3") remindersSent += 1
    if (outcome.sent && group.stage === "day6") warningsSent += 1
    if (outcome.inApp) inAppNotified += 1
    if (outcome.klaviyo) klaviyoEmitted += 1
    failed += outcome.failed
    errors.push(...outcome.errors)
  }

  return {
    eligible: dueRows.length,
    listingsProcessed: groups.length,
    remindersSent,
    warningsSent,
    vacationApplied,
    inAppNotified,
    klaviyoEmitted,
    failed,
    errors: errors.slice(0, 50),
  }
}

async function processReminder(
  supabase: SupabaseClient,
  group: ListingInactivityGroup,
): Promise<{ sent: boolean; inApp: boolean; klaviyo: boolean; failed: number; errors: string[] }> {
  const errors: string[] = []
  const notice = await publishNotice(supabase, group)
  if (!notice.ok) {
    return {
      sent: false,
      inApp: false,
      klaviyo: false,
      failed: 1,
      errors: [`${group.listingId}: in-app ${group.stage} failed — ${notice.error}`],
    }
  }

  const [listingImages, sellerDisplayName] = await Promise.all([
    fetchListingImagesForKlaviyo(supabase, group.listingId),
    fetchSellerDisplayName(supabase, group.sellerId),
  ])

  const klaviyoResult = await trackKlaviyoSellerMessageReminder({
    stage: group.stage === "day6" ? "day6" : "day3",
    sellerUserId: group.sellerId,
    sellerDisplayName,
    listingId: group.listingId,
    listingTitle: group.listingTitle,
    listingSlug: group.listingSlug,
    listingSection: group.listingSection,
    listingImages,
    missedMessages: buildMissedMessages(group.rows),
  })

  const klaviyoOk = klaviyoResult.ok || klaviyoResult.skipped
  if (!klaviyoOk) {
    return {
      sent: false,
      inApp: true,
      klaviyo: false,
      failed: 1,
      errors: [
        `${group.listingId}: Klaviyo ${group.stage} ${klaviyoResult.status} — ${klaviyoResult.detail.slice(0, 200)}`,
      ],
    }
  }

  const notifiedAt = new Date().toISOString()
  const recordOutcomes = await Promise.all(
    group.rows.map((row) =>
      recordSellerMessageReminder(supabase, {
        listingId: row.listing_id,
        conversationId: row.conversation_id,
        sellerId: row.seller_id,
        buyerMessageId: row.buyer_message_id,
        buyerMessageAt: row.buyer_message_at,
        stage: group.stage === "day6" ? "day6" : "day3",
        notifiedAt,
      }),
    ),
  )

  let failed = 0
  for (const [i, rec] of recordOutcomes.entries()) {
    if (rec.error) {
      failed += 1
      errors.push(`${group.rows[i]?.conversation_id}: record ${group.stage} failed — ${rec.error}`)
    }
  }

  return { sent: failed === 0, inApp: true, klaviyo: klaviyoResult.ok, failed, errors }
}

async function processDay7(
  supabase: SupabaseClient,
  group: ListingInactivityGroup,
): Promise<{
  vacationApplied: boolean
  inApp: boolean
  klaviyo: boolean
  failed: number
  errors: string[]
}> {
  const errors: string[] = []
  const vacationResult = await setListingVacationModeForSeller({
    supabase,
    userId: group.sellerId,
    listingId: group.listingId,
    vacationMode: true,
    source: "seller_inactivity",
  })

  if (!vacationResult.ok) {
    return {
      vacationApplied: false,
      inApp: false,
      klaviyo: false,
      failed: 1,
      errors: [`${group.listingId}: vacation mode failed — ${vacationResult.error}`],
    }
  }

  const notice = await publishNotice(supabase, group)
  let inApp = false
  let hiddenNotifiedAt: string | null = null
  if (notice.ok) {
    inApp = true
    hiddenNotifiedAt = new Date().toISOString()
  } else {
    errors.push(`${group.listingId}: in-app day7 failed — ${notice.error}`)
  }

  const [listingImages, sellerDisplayName] = await Promise.all([
    fetchListingImagesForKlaviyo(supabase, group.listingId),
    fetchSellerDisplayName(supabase, group.sellerId),
  ])

  const klaviyoResult = await trackKlaviyoInactiveSeller({
    sellerUserId: group.sellerId,
    sellerDisplayName,
    listingId: group.listingId,
    listingTitle: group.listingTitle,
    listingSlug: group.listingSlug,
    listingSection: group.listingSection,
    listingImages,
    vacationModeApplied: true,
    missedMessages: buildMissedMessages(group.rows),
  })

  const klaviyoOk = klaviyoResult.ok || klaviyoResult.skipped
  let failed = notice.ok ? 0 : 1
  if (!klaviyoOk) {
    failed += 1
    errors.push(
      `${group.listingId}: Klaviyo ${klaviyoResult.status} — ${klaviyoResult.detail.slice(0, 200)}`,
    )
  }

  const vacationAppliedAt = new Date().toISOString()
  const recordOutcomes = await Promise.all(
    group.rows.map((row) =>
      recordSellerMessageInactivityAction(supabase, {
        listingId: row.listing_id,
        conversationId: row.conversation_id,
        sellerId: row.seller_id,
        buyerMessageId: row.buyer_message_id,
        buyerMessageAt: row.buyer_message_at,
        vacationAppliedAt,
        klaviyoSentAt: klaviyoResult.ok ? vacationAppliedAt : null,
        hiddenNotifiedAt,
      }),
    ),
  )

  for (const [i, rec] of recordOutcomes.entries()) {
    if (rec.error) {
      failed += 1
      errors.push(`${group.rows[i]?.conversation_id}: record action failed — ${rec.error}`)
    }
  }

  return {
    vacationApplied: true,
    inApp,
    klaviyo: klaviyoResult.ok,
    failed,
    errors,
  }
}
