import type { SupabaseClient } from "@supabase/supabase-js"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { notifyFollowersOfNewListing } from "@/lib/follows/notify-followers"

const PAGE_SIZE = 400
const MAX_FOLLOWERS_PER_RUN = 1200
const JOBS_PER_RUN = 2
const MAX_ATTEMPTS = 5
const STALE_PROCESSING_MS = 15 * 60 * 1000

export interface NotificationFanoutSummary {
  claimed: number
  completed: number
  resumed: number
  failed: number
  followers: number
}

interface FanoutJobRow {
  id: string
  kind: string
  listing_id: string
  cursor: string | null
  attempts: number
}

/**
 * Queue in-app follower fan-out. A repeat publish of the same listing does not
 * reset a job that already ran. A failed job is returned to the queue.
 */
export async function enqueueNewListingInAppFanout(
  supabase: SupabaseClient,
  listingId: string,
): Promise<void> {
  const { error } = await supabase.from("notification_fanout_jobs").insert({
    kind: "new_listing",
    listing_id: listingId,
    status: "pending",
  })
  if (!error) return
  if (error.code !== "23505") {
    throw new Error(`notification fanout enqueue failed: ${error.message}`)
  }
  const { error: retryError } = await supabase
    .from("notification_fanout_jobs")
    .update({ status: "pending", last_error: null, finished_at: null })
    .eq("kind", "new_listing")
    .eq("listing_id", listingId)
    .eq("status", "failed")
  if (retryError) {
    throw new Error(`notification fanout retry failed: ${retryError.message}`)
  }
}

export async function processNotificationFanoutJobs(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<NotificationFanoutSummary> {
  const summary: NotificationFanoutSummary = {
    claimed: 0,
    completed: 0,
    resumed: 0,
    failed: 0,
    followers: 0,
  }

  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS).toISOString()
  await supabase
    .from("notification_fanout_jobs")
    .update({ status: "pending" })
    .eq("status", "processing")
    .lt("started_at", staleBefore)

  const { data: pending, error } = await supabase
    .from("notification_fanout_jobs")
    .select("id, kind, listing_id, cursor, attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(JOBS_PER_RUN)

  if (error) throw new Error(`notification fanout list failed: ${error.message}`)

  for (const job of (pending ?? []) as FanoutJobRow[]) {
    const claimed = await claimJob(supabase, job, now)
    if (!claimed) continue
    summary.claimed += 1
    try {
      const result = await runJob(supabase, claimed)
      summary.followers += result.followers
      if (result.done) summary.completed += 1
      else summary.resumed += 1
    } catch (jobError) {
      summary.failed += 1
      const message = jobError instanceof Error ? jobError.message : String(jobError)
      const attempts = claimed.attempts + 1
      await supabase
        .from("notification_fanout_jobs")
        .update({
          status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          attempts,
          last_error: message.slice(0, 500),
          finished_at: attempts >= MAX_ATTEMPTS ? now.toISOString() : null,
        })
        .eq("id", claimed.id)
    }
  }

  return summary
}

async function claimJob(
  supabase: SupabaseClient,
  job: FanoutJobRow,
  now: Date,
): Promise<FanoutJobRow | null> {
  const { data, error } = await supabase
    .from("notification_fanout_jobs")
    .update({ status: "processing", started_at: now.toISOString() })
    .eq("id", job.id)
    .eq("status", "pending")
    .select("id, kind, listing_id, cursor, attempts")
    .maybeSingle()
  if (error) throw new Error(`notification fanout claim failed: ${error.message}`)
  return (data as FanoutJobRow | null) ?? null
}

async function runJob(
  supabase: SupabaseClient,
  job: FanoutJobRow,
): Promise<{ done: boolean; followers: number }> {
  const { data: listing, error } = await supabase
    .from("listings")
    .select("id, user_id, title, price, slug, section, status, hidden_from_site")
    .eq("id", job.listing_id)
    .maybeSingle()

  if (error) throw new Error(`notification fanout listing read failed: ${error.message}`)
  if (
    !listing ||
    !isPeerListingSection(listing.section) ||
    listing.status !== "active" ||
    listing.hidden_from_site
  ) {
    await finishJob(supabase, job.id)
    return { done: true, followers: 0 }
  }

  const sellerId = String(listing.user_id)
  const { data: seller } = await supabase
    .from("profiles")
    .select("display_name, shop_name, is_shop")
    .eq("id", sellerId)
    .maybeSingle()

  const shopName = shopDisplayName(seller)
  let cursor = job.cursor
  let followers = 0

  while (followers < MAX_FOLLOWERS_PER_RUN) {
    let query = supabase
      .from("seller_follows")
      .select("follower_id")
      .eq("seller_id", sellerId)
      .order("follower_id", { ascending: true })
      .limit(PAGE_SIZE)
    if (cursor) query = query.gt("follower_id", cursor)

    const { data: follows, error: followError } = await query
    if (followError) throw new Error(`notification fanout follows read failed: ${followError.message}`)

    const rows = follows ?? []
    const followerIds = rows
      .map((row) => row.follower_id)
      .filter((id): id is string => typeof id === "string" && id !== sellerId)
    const lastId = rows[rows.length - 1]?.follower_id
    if (typeof lastId === "string") cursor = lastId

    if (followerIds.length > 0) {
      await notifyFollowersOfNewListing(supabase, {
        sellerId,
        listingId: listing.id,
        listingTitle: String(listing.title ?? ""),
        listingSlug: typeof listing.slug === "string" ? listing.slug : null,
        listingPrice:
          typeof listing.price === "number" || typeof listing.price === "string" ? listing.price : null,
        shopName,
        followerIds,
      })
    }

    followers += followerIds.length
    const more = rows.length === PAGE_SIZE
    if (rows.length === 0) {
      await finishJob(supabase, job.id)
      return { done: true, followers }
    }
    if (!more || followers >= MAX_FOLLOWERS_PER_RUN) {
      if (!more) {
        await finishJob(supabase, job.id)
        return { done: true, followers }
      }
      const { error: pauseError } = await supabase
        .from("notification_fanout_jobs")
        .update({ status: "pending", cursor, last_error: null })
        .eq("id", job.id)
      if (pauseError) throw new Error(`notification fanout pause failed: ${pauseError.message}`)
      return { done: false, followers }
    }
  }

  return { done: true, followers }
}

async function finishJob(supabase: SupabaseClient, jobId: string): Promise<void> {
  const { error } = await supabase
    .from("notification_fanout_jobs")
    .update({
      status: "done",
      cursor: null,
      finished_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", jobId)
  if (error) throw new Error(`notification fanout finish failed: ${error.message}`)
}

function shopDisplayName(
  data: { display_name?: string | null; shop_name?: string | null; is_shop?: boolean | null } | null,
): string {
  if (!data) return "A seller"
  const shop = typeof data.shop_name === "string" ? data.shop_name.trim() : ""
  if (data.is_shop && shop) return shop
  const name = typeof data.display_name === "string" ? data.display_name.trim() : ""
  return name || "A seller"
}
