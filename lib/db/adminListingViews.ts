import type {
  AdminListingViewRow,
  AdminListingViewsDashboard,
  AdminListingViewsPeriod,
  AdminListingViewsSummary,
} from "@/lib/types/adminListingViews"
import type { AdminListingViewsQuery } from "@/lib/validations/adminListingViews"
import { createServiceRoleClient } from "@/lib/supabase/server"

function periodSinceIso(period: AdminListingViewsPeriod): string | null {
  if (period === "all") return null
  const days = period === "7d" ? 7 : 30
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function asInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === "string" && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return Math.trunc(n)
  }
  return 0
}

async function fetchSummary(
  supabase: ReturnType<typeof createServiceRoleClient>,
  period: AdminListingViewsPeriod,
  userId?: string,
  listingId?: string,
): Promise<AdminListingViewsSummary> {
  const since = periodSinceIso(period)
  let query = supabase
    .from("user_recently_viewed_listings")
    .select("user_id, listing_id, view_count")

  if (since) query = query.gte("viewed_at", since)
  if (userId) query = query.eq("user_id", userId)
  if (listingId) query = query.eq("listing_id", listingId)

  // Cap aggregation scan — admin filter pages rarely need unbounded history in memory.
  const { data, error } = await query.limit(10000)
  if (error || !data) {
    if (error) console.error("[adminListingViews] summary:", error)
    return { uniqueViewers: 0, distinctListings: 0, totalViewEvents: 0 }
  }

  const viewers = new Set<string>()
  const listings = new Set<string>()
  let totalViewEvents = 0
  for (const row of data) {
    const uid = typeof row.user_id === "string" ? row.user_id : ""
    const lid = typeof row.listing_id === "string" ? row.listing_id : ""
    if (uid) viewers.add(uid)
    if (lid) listings.add(lid)
    totalViewEvents += Math.max(1, asInt(row.view_count))
  }

  return {
    uniqueViewers: viewers.size,
    distinctListings: listings.size,
    totalViewEvents,
  }
}

export async function fetchAdminListingViewsDashboard(
  query: AdminListingViewsQuery,
): Promise<{ ok: true; data: AdminListingViewsDashboard } | { ok: false; error: string }> {
  try {
    const supabase = createServiceRoleClient()
    const period = query.period
    const page = query.page
    const pageSize = query.pageSize
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    const since = periodSinceIso(period)

    let rowsQuery = supabase
      .from("user_recently_viewed_listings")
      .select("user_id, listing_id, view_count, first_viewed_at, viewed_at", { count: "exact" })
      .order("viewed_at", { ascending: false })
      .range(from, to)

    if (since) rowsQuery = rowsQuery.gte("viewed_at", since)
    if (query.userId) rowsQuery = rowsQuery.eq("user_id", query.userId)
    if (query.listingId) rowsQuery = rowsQuery.eq("listing_id", query.listingId)

    const [rowsRes, summary] = await Promise.all([
      rowsQuery,
      fetchSummary(supabase, period, query.userId, query.listingId),
    ])

    if (rowsRes.error) {
      console.error("[adminListingViews] rows:", rowsRes.error)
      return { ok: false, error: rowsRes.error.message }
    }

    const rawRows = rowsRes.data ?? []
    const userIds = [...new Set(rawRows.map((r) => asString(r.user_id)).filter(Boolean))] as string[]
    const listingIds = [
      ...new Set(rawRows.map((r) => asString(r.listing_id)).filter(Boolean)),
    ] as string[]

    const [profilesRes, listingsRes] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("id, display_name, email").in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; display_name: string | null; email: string | null }[], error: null }),
      listingIds.length
        ? supabase
            .from("listings")
            .select("id, title, slug, status, section")
            .in("id", listingIds)
        : Promise.resolve({
            data: [] as {
              id: string
              title: string | null
              slug: string | null
              status: string | null
              section: string | null
            }[],
            error: null,
          }),
    ])

    if (profilesRes.error) {
      console.error("[adminListingViews] profiles:", profilesRes.error)
    }
    if (listingsRes.error) {
      console.error("[adminListingViews] listings:", listingsRes.error)
    }

    const profilesById = new Map(
      (profilesRes.data ?? []).map((p) => [
        p.id,
        { displayName: p.display_name, email: p.email },
      ]),
    )
    const listingsById = new Map(
      (listingsRes.data ?? []).map((l) => [
        l.id,
        {
          title: l.title,
          slug: l.slug,
          status: l.status,
          section: l.section,
        },
      ]),
    )

    const rows: AdminListingViewRow[] = []
    for (const raw of rawRows) {
      const userId = asString(raw.user_id)
      const listingId = asString(raw.listing_id)
      const firstViewedAt = asString(raw.first_viewed_at)
      const lastViewedAt = asString(raw.viewed_at)
      if (!userId || !listingId || !firstViewedAt || !lastViewedAt) continue

      const profile = profilesById.get(userId)
      const listing = listingsById.get(listingId)
      if (!listing) continue

      rows.push({
        userId,
        userDisplayName: profile?.displayName ?? null,
        userEmail: profile?.email ?? null,
        listingId,
        listingTitle: listing.title?.trim() || "Untitled listing",
        listingSlug: listing.slug,
        listingStatus: listing.status || "unknown",
        listingSection: listing.section || "unknown",
        viewCount: Math.max(1, asInt(raw.view_count)),
        firstViewedAt,
        lastViewedAt,
      })
    }

    const totalRows = rowsRes.count ?? rows.length
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))

    return {
      ok: true,
      data: {
        period,
        summary,
        rows,
        page,
        pageSize,
        totalRows,
        totalPages,
      },
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load listing views"
    return { ok: false, error: message }
  }
}
