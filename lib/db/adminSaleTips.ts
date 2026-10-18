import type { SupabaseClient } from "@supabase/supabase-js"
import {
  ADMIN_SALE_TIP_PAGE_SIZE,
  type AdminSaleTipStatus,
  isAdminSaleTipStatus,
  isUuid,
  sanitizeAdminSaleTipSearch,
  summarizeSucceededTips,
} from "@/lib/admin/sale-tip-filters"
import type {
  AdminSaleTipDirectory,
  AdminSaleTipListItem,
  AdminSaleTipSellerFilter,
  AdminSaleTipSummary,
  AdminUserSaleTip,
} from "@/lib/types/adminSaleTips"

const SEARCH_ID_CAP = 80
const SUMMARY_ROW_CAP = 20000
const USER_TIP_CAP = 50

type TipSource = {
  id: string
  listing_id: string
  seller_user_id: string
  amount_cents: number
  stripe_payment_intent_id: string
  status: AdminSaleTipStatus
  created_at: string
  succeeded_at: string | null
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function cents(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n)
}

function parseTipSource(raw: unknown): TipSource | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const id = text(row.id)
  const listingId = text(row.listing_id)
  const sellerUserId = text(row.seller_user_id)
  const paymentIntentId = text(row.stripe_payment_intent_id)
  const status = text(row.status)
  const createdAt = text(row.created_at)
  if (!id || !listingId || !sellerUserId || !paymentIntentId || !status || !createdAt) return null
  if (!isAdminSaleTipStatus(status)) return null
  return {
    id,
    listing_id: listingId,
    seller_user_id: sellerUserId,
    amount_cents: cents(row.amount_cents),
    stripe_payment_intent_id: paymentIntentId,
    status,
    created_at: createdAt,
    succeeded_at: text(row.succeeded_at),
  }
}

async function countByStatus(
  supabase: SupabaseClient,
  status: AdminSaleTipStatus,
): Promise<number> {
  const { count, error } = await supabase
    .from("seller_sale_tips")
    .select("id", { count: "exact", head: true })
    .eq("status", status)
  if (error) {
    console.error("[adminSaleTips] status count failed", status, error)
    throw new Error("tip summary failed")
  }
  return count ?? 0
}

async function loadSummary(supabase: SupabaseClient): Promise<AdminSaleTipSummary> {
  const [succeededCount, pendingCount, failedCount, canceledCount, amountRows] = await Promise.all([
    countByStatus(supabase, "succeeded"),
    countByStatus(supabase, "pending"),
    countByStatus(supabase, "failed"),
    countByStatus(supabase, "canceled"),
    supabase
      .from("seller_sale_tips")
      .select("seller_user_id, amount_cents")
      .eq("status", "succeeded")
      .limit(SUMMARY_ROW_CAP),
  ])

  if (amountRows.error) {
    console.error("[adminSaleTips] succeeded amounts failed", amountRows.error)
    throw new Error("tip summary failed")
  }

  const totals = summarizeSucceededTips(
    (amountRows.data ?? []).map((row) => {
      const record = row as { seller_user_id?: unknown; amount_cents?: unknown }
      return {
        amountCents: cents(record.amount_cents),
        sellerUserId: text(record.seller_user_id) ?? "",
      }
    }),
  )

  return {
    succeededCount,
    pendingCount,
    failedCount,
    canceledCount,
    succeededAmountCents: totals.amountCents,
    uniqueSucceededSellers: totals.sellerCount,
  }
}

async function matchingIds(
  supabase: SupabaseClient,
  table: "profiles" | "listings",
  column: "display_name" | "email" | "title",
  search: string,
): Promise<string[]> {
  const pattern = `%${search}%`
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .ilike(column, pattern)
    .limit(SEARCH_ID_CAP)
  if (error) {
    console.error("[adminSaleTips] search lookup failed", table, column, error)
    throw new Error("tip search failed")
  }
  const ids: string[] = []
  for (const row of data ?? []) {
    const id = text((row as { id?: unknown }).id)
    if (id && isUuid(id)) ids.push(id)
  }
  return ids
}

async function sellerIdsForSearch(supabase: SupabaseClient, search: string): Promise<string[]> {
  const [byName, byEmail] = await Promise.all([
    matchingIds(supabase, "profiles", "display_name", search),
    matchingIds(supabase, "profiles", "email", search),
  ])
  return [...new Set([...byName, ...byEmail])].slice(0, SEARCH_ID_CAP)
}

async function loadProfiles(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, { displayName: string | null; email: string | null }>> {
  const map = new Map<string, { displayName: string | null; email: string | null }>()
  if (ids.length === 0) return map
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .in("id", ids)
  if (error) {
    console.error("[adminSaleTips] profiles failed", error)
    throw new Error("tip profiles failed")
  }
  for (const row of data ?? []) {
    const record = row as { id?: unknown; display_name?: unknown; email?: unknown }
    const id = text(record.id)
    if (!id) continue
    map.set(id, {
      displayName: text(record.display_name),
      email: text(record.email),
    })
  }
  return map
}

async function loadListings(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, { title: string | null; slug: string | null; status: string | null }>> {
  const map = new Map<string, { title: string | null; slug: string | null; status: string | null }>()
  if (ids.length === 0) return map
  const { data, error } = await supabase
    .from("listings")
    .select("id, title, slug, status")
    .in("id", ids)
  if (error) {
    console.error("[adminSaleTips] listings failed", error)
    throw new Error("tip listings failed")
  }
  for (const row of data ?? []) {
    const record = row as { id?: unknown; title?: unknown; slug?: unknown; status?: unknown }
    const id = text(record.id)
    if (!id) continue
    map.set(id, {
      title: text(record.title),
      slug: text(record.slug),
      status: text(record.status),
    })
  }
  return map
}

function toListItem(
  tip: TipSource,
  profiles: Map<string, { displayName: string | null; email: string | null }>,
  listings: Map<string, { title: string | null; slug: string | null; status: string | null }>,
): AdminSaleTipListItem {
  const seller = profiles.get(tip.seller_user_id)
  const listing = listings.get(tip.listing_id)
  return {
    id: tip.id,
    amountCents: tip.amount_cents,
    status: tip.status,
    createdAt: tip.created_at,
    succeededAt: tip.succeeded_at,
    stripePaymentIntentId: tip.stripe_payment_intent_id,
    sellerUserId: tip.seller_user_id,
    sellerDisplayName: seller?.displayName ?? null,
    sellerEmail: seller?.email ?? null,
    listingId: tip.listing_id,
    listingTitle: listing?.title ?? null,
    listingSlug: listing?.slug ?? null,
    listingStatus: listing?.status ?? null,
  }
}

export async function dbListAdminSaleTips(
  supabase: SupabaseClient,
  input: {
    status: AdminSaleTipStatus | "all"
    q: string
    sellerUserId: string | null
    page: number
  },
): Promise<AdminSaleTipDirectory> {
  const search = sanitizeAdminSaleTipSearch(input.q)
  const page = input.page
  const summary = await loadSummary(supabase)

  let sellerIds: string[] = []
  let listingIds: string[] = []
  if (search) {
    ;[sellerIds, listingIds] = await Promise.all([
      sellerIdsForSearch(supabase, search),
      matchingIds(supabase, "listings", "title", search),
    ])
  }

  const searchClauses: string[] = []
  if (search) {
    if (sellerIds.length > 0) searchClauses.push(`seller_user_id.in.(${sellerIds.join(",")})`)
    if (listingIds.length > 0) searchClauses.push(`listing_id.in.(${listingIds.join(",")})`)
    searchClauses.push(`stripe_payment_intent_id.ilike."%${search}%"`)
    if (isUuid(search)) {
      searchClauses.push(`id.eq.${search}`)
      searchClauses.push(`seller_user_id.eq.${search}`)
      searchClauses.push(`listing_id.eq.${search}`)
    }
  }

  const empty = (sellerFilter: AdminSaleTipSellerFilter | null): AdminSaleTipDirectory => ({
    items: [],
    total: 0,
    page,
    pageSize: ADMIN_SALE_TIP_PAGE_SIZE,
    summary,
    sellerFilter,
    filters: {
      status: input.status,
      q: search,
      sellerUserId: input.sellerUserId,
    },
  })

  if (search && searchClauses.length === 0) {
    const sellerFilter = input.sellerUserId
      ? await loadSellerFilter(supabase, input.sellerUserId)
      : null
    return empty(sellerFilter)
  }

  const from = (page - 1) * ADMIN_SALE_TIP_PAGE_SIZE
  const to = from + ADMIN_SALE_TIP_PAGE_SIZE - 1
  let query = supabase
    .from("seller_sale_tips")
    .select(
      "id, listing_id, seller_user_id, amount_cents, stripe_payment_intent_id, status, created_at, succeeded_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to)

  if (input.status !== "all") query = query.eq("status", input.status)
  if (input.sellerUserId) query = query.eq("seller_user_id", input.sellerUserId)
  if (searchClauses.length > 0) query = query.or(searchClauses.join(","))

  const { data, error, count } = await query
  if (error) {
    console.error("[adminSaleTips] list failed", error)
    throw new Error("tip list failed")
  }

  const tips = (data ?? []).map(parseTipSource).filter((row): row is TipSource => row !== null)
  const [profiles, listings, sellerFilter] = await Promise.all([
    loadProfiles(supabase, [...new Set(tips.map((tip) => tip.seller_user_id))]),
    loadListings(supabase, [...new Set(tips.map((tip) => tip.listing_id))]),
    input.sellerUserId ? loadSellerFilter(supabase, input.sellerUserId) : Promise.resolve(null),
  ])

  return {
    items: tips.map((tip) => toListItem(tip, profiles, listings)),
    total: count ?? tips.length,
    page,
    pageSize: ADMIN_SALE_TIP_PAGE_SIZE,
    summary,
    sellerFilter,
    filters: {
      status: input.status,
      q: search,
      sellerUserId: input.sellerUserId,
    },
  }
}

async function loadSellerFilter(
  supabase: SupabaseClient,
  sellerUserId: string,
): Promise<AdminSaleTipSellerFilter | null> {
  const profiles = await loadProfiles(supabase, [sellerUserId])
  const profile = profiles.get(sellerUserId)
  if (!profile) return { id: sellerUserId, displayName: null, email: null }
  return { id: sellerUserId, displayName: profile.displayName, email: profile.email }
}

export async function dbListSaleTipsForSeller(
  supabase: SupabaseClient,
  sellerUserId: string,
): Promise<AdminUserSaleTip[]> {
  const { data, error } = await supabase
    .from("seller_sale_tips")
    .select("id, listing_id, amount_cents, status, created_at, succeeded_at, seller_user_id, stripe_payment_intent_id")
    .eq("seller_user_id", sellerUserId)
    .order("created_at", { ascending: false })
    .limit(USER_TIP_CAP)

  if (error) {
    console.error("[adminSaleTips] user tips failed", error)
    return []
  }

  const tips = (data ?? []).map(parseTipSource).filter((row): row is TipSource => row !== null)
  const listings = await loadListings(
    supabase,
    [...new Set(tips.map((tip) => tip.listing_id))],
  ).catch((loadError: unknown) => {
    console.error("[adminSaleTips] user tip listings failed", loadError)
    return new Map<string, { title: string | null; slug: string | null; status: string | null }>()
  })

  return tips.map((tip) => {
    const listing = listings.get(tip.listing_id)
    return {
      id: tip.id,
      listingId: tip.listing_id,
      listingTitle: listing?.title ?? null,
      listingSlug: listing?.slug ?? null,
      amountCents: tip.amount_cents,
      status: tip.status,
      createdAt: tip.created_at,
      succeededAt: tip.succeeded_at,
    }
  })
}
