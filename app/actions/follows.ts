"use server"

import { createClient } from "@/lib/supabase/server"

export async function followSeller(
  sellerId: string,
): Promise<{ following: true; followerCount: number } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Sign in to follow sellers." }
  }

  if (!sellerId) {
    return { error: "Missing sellerId." }
  }

  if (user.id === sellerId) {
    return { error: "You can't follow yourself." }
  }

  const { data: seller, error: sellerErr } = await supabase
    .from("profiles")
    .select("id, follower_count")
    .eq("id", sellerId)
    .single()

  if (sellerErr || !seller) {
    return { error: "Seller not found." }
  }

  const { error } = await supabase.from("seller_follows").upsert(
    { follower_id: user.id, seller_id: sellerId },
    { onConflict: "follower_id,seller_id", ignoreDuplicates: true },
  )

  if (error) {
    console.error("[follows] insert error:", error)
    return { error: "Failed to follow seller." }
  }

  const { data: updated } = await supabase
    .from("profiles")
    .select("follower_count")
    .eq("id", sellerId)
    .single()

  return { following: true, followerCount: updated?.follower_count ?? 0 }
}

export async function unfollowSeller(
  sellerId: string,
): Promise<{ following: false; followerCount: number } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized." }
  }

  if (!sellerId) {
    return { error: "Missing sellerId." }
  }

  const { error } = await supabase
    .from("seller_follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("seller_id", sellerId)

  if (error) {
    console.error("[follows] delete error:", error)
    return { error: "Failed to unfollow." }
  }

  const { data: updated } = await supabase
    .from("profiles")
    .select("follower_count")
    .eq("id", sellerId)
    .single()

  return { following: false, followerCount: updated?.follower_count ?? 0 }
}

export async function getFollowStatusForSeller(sellerId: string): Promise<{
  following: boolean
  followerCount: number
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("follower_count")
    .eq("id", sellerId)
    .single()

  const followerCount = profile?.follower_count ?? 0

  if (!user) {
    return { following: false, followerCount }
  }

  const { data: follow } = await supabase
    .from("seller_follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("seller_id", sellerId)
    .maybeSingle()

  return { following: !!follow, followerCount }
}

export async function getFollowingFeedPage(opts: {
  cursor?: string | null
  limit?: number
}) {
  const limit = Math.min(opts.limit ?? 20, 50)
  const cursor = opts.cursor ?? null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized." as const, listings: [] as unknown[], hasMore: false, nextCursor: null as string | null }
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: followedSellers } = await supabase
    .from("seller_follows")
    .select("seller_id")
    .eq("follower_id", user.id)

  const sellerIds = (followedSellers ?? []).map((f) => f.seller_id)

  if (sellerIds.length === 0) {
    return { listings: [], hasMore: false, nextCursor: null }
  }

  let query = supabase
    .from("listings")
    .select(
      `
      id,
      title,
      price,
      slug,
      section,
      created_at,
      city,
      state,
      listing_images (url, is_primary),
      seller:profiles!listings_user_id_fkey (
        id,
        seller_slug,
        display_name,
        shop_name,
        avatar_url,
        city
      )
    `,
    )
    .in("user_id", sellerIds)
    .eq("status", "active")
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt("created_at", cursor)
  }

  const { data: listings, error } = await query

  if (error) {
    console.error("[following/feed] error:", error)
    return { error: "Failed to load feed." as const, listings: [], hasMore: false, nextCursor: null }
  }

  const hasMore = (listings?.length ?? 0) > limit
  const items = (listings ?? []).slice(0, limit)
  const nextCursor = hasMore ? items[items.length - 1]?.created_at ?? null : null

  return { listings: items, hasMore, nextCursor }
}

export async function getFollowNotifications(opts: { limit?: number; unreadOnly?: boolean }) {
  const limit = Math.min(opts.limit ?? 30, 50)
  const unreadOnly = opts.unreadOnly !== false

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized." as const, notifications: [], unreadCount: 0 }
  }

  let query = supabase
    .from("notifications")
    .select(
      `
      id,
      type,
      listing_id,
      actor_id,
      message,
      is_read,
      created_at,
      actor:profiles!notifications_actor_id_fkey (
        id,
        display_name,
        shop_name,
        avatar_url,
        city
      ),
      listing:listings!notifications_listing_id_fkey (
        id,
        title,
        price,
        slug,
        section,
        listing_images (url, is_primary)
      )
    `,
    )
    .eq("user_id", user.id)
    .in("type", ["new_listing_from_followed", "price_drop_from_followed"])
    .order("created_at", { ascending: false })
    .limit(limit)

  if (unreadOnly) {
    query = query.eq("is_read", false)
  }

  const { data: notifications, error } = await query

  if (error) {
    console.error("[follow notifications] query error:", error)
    return { error: "Failed to load notifications." as const, notifications: [], unreadCount: 0 }
  }

  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("type", ["new_listing_from_followed", "price_drop_from_followed"])
    .eq("is_read", false)

  return { notifications: notifications ?? [], unreadCount: unreadCount ?? 0 }
}

export async function markFollowNotificationsRead(opts: { ids?: string[] }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized." as const, ok: false as const }
  }

  const { ids } = opts

  let query = supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .in("type", ["new_listing_from_followed", "price_drop_from_followed"])

  if (ids && ids.length > 0) {
    query = query.in("id", ids)
  }

  const { error } = await query

  if (error) {
    return { error: "Failed to mark as read." as const, ok: false as const }
  }

  return { ok: true as const }
}

export async function getNotificationPreferences() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized." as const, prefs: null }
  }

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("follow_in_app, follow_email_digest, digest_time")
    .eq("user_id", user.id)
    .maybeSingle()

  return {
    prefs:
      prefs ?? {
        follow_in_app: true,
        follow_email_digest: true,
        digest_time: "morning",
      },
  }
}

export async function saveNotificationPreferences(body: {
  follow_in_app?: boolean
  follow_email_digest?: boolean
  digest_time?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized." as const }
  }

  const { follow_in_app, follow_email_digest, digest_time } = body

  const { error } = await supabase.from("notification_preferences").upsert(
    { user_id: user.id, follow_in_app, follow_email_digest, digest_time },
    { onConflict: "user_id" },
  )

  if (error) {
    return { error: "Failed to save preferences." }
  }
  return { ok: true as const }
}
