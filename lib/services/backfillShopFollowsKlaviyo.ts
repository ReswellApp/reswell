/**
 * One-time (or rare) backfill: emit **Shop Followed** + **Following Shop** for every
 * existing `seller_follows` row with `is_backfill: true` so:
 * - Seller flows can filter out historical follows (no email spam)
 * - Follower emails are entered into Klaviyo for **Followed Seller New Listing** flows
 */

import { notifyShopFollowKlaviyo } from "@/lib/services/notifyShopFollowKlaviyo"
import { createServiceRoleClient } from "@/lib/supabase/server"

export type BackfillShopFollowsKlaviyoResult = {
  total: number
  processed: number
  failed: number
  skippedReason?: string
}

const PAGE_SIZE = 100

/**
 * Pages through all follows and emits Klaviyo events. Bounded concurrency via
 * sequential pages; within a page, events run in parallel per row.
 */
export async function backfillShopFollowsKlaviyo(opts?: {
  /** Max rows to process (for dry runs / staged rollouts). */
  limit?: number
}): Promise<BackfillShopFollowsKlaviyoResult> {
  let admin
  try {
    admin = createServiceRoleClient()
  } catch {
    return { total: 0, processed: 0, failed: 0, skippedReason: "missing_service_role" }
  }

  const hardLimit =
    typeof opts?.limit === "number" && opts.limit > 0 ? Math.floor(opts.limit) : null

  const { count, error: countErr } = await admin
    .from("seller_follows")
    .select("id", { count: "exact", head: true })

  if (countErr) {
    console.error("[klaviyo] shop-follow backfill count:", countErr)
    return { total: 0, processed: 0, failed: 0, skippedReason: "count_failed" }
  }

  const total = count ?? 0
  let processed = 0
  let failed = 0
  let offset = 0

  while (true) {
    if (hardLimit != null && processed >= hardLimit) break

    const pageLimit =
      hardLimit != null
        ? Math.min(PAGE_SIZE, hardLimit - processed)
        : PAGE_SIZE

    const { data: rows, error } = await admin
      .from("seller_follows")
      .select("id, follower_id, seller_id, created_at")
      .order("created_at", { ascending: true })
      .range(offset, offset + pageLimit - 1)

    if (error) {
      console.error("[klaviyo] shop-follow backfill page:", error)
      return { total, processed, failed, skippedReason: "page_failed" }
    }

    if (!rows || rows.length === 0) break

    const settled = await Promise.all(
      rows.map(async (row) => {
        try {
          await notifyShopFollowKlaviyo({
            followId: String(row.id),
            followedAt:
              typeof row.created_at === "string"
                ? row.created_at
                : new Date().toISOString(),
            sellerUserId: String(row.seller_id),
            followerUserId: String(row.follower_id),
            isBackfill: true,
          })
          return "ok" as const
        } catch (e) {
          console.error(
            "[klaviyo] shop-follow backfill row:",
            row.id,
            e instanceof Error ? e.message : e,
          )
          return "fail" as const
        }
      }),
    )

    for (const s of settled) {
      if (s === "ok") processed += 1
      else failed += 1
    }

    offset += rows.length
    if (rows.length < pageLimit) break
  }

  return { total, processed, failed }
}
