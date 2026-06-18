import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  AdminPromoCodeSortKey,
  AdminPromoCodeStats,
  AdminPromoCodeStatusFilter,
} from "@/lib/types/admin-promo-codes"
import type { NewsletterPromoCodeRow } from "@/lib/db/newsletterPromoCodes"

const PROMO_SELECT =
  "id, email, code, discount_percent, expires_at, redeemed_at, redeemed_by_profile_id, redeemed_order_id, reserved_payment_intent_id, created_at"

export type AdminPromoOrderRow = {
  id: string
  order_num: string | null
  amount: number | string
  promo_discount_usd: number | string
  status: string
  created_at: string
  promo_code_id: string | null
}

function resolvePromoStatus(
  row: Pick<
    NewsletterPromoCodeRow,
    "redeemed_at" | "expires_at" | "reserved_payment_intent_id"
  >,
  now = new Date(),
): "active" | "reserved" | "redeemed" | "expired" {
  if (row.redeemed_at) return "redeemed"
  if (row.reserved_payment_intent_id?.trim()) return "reserved"
  if (new Date(row.expires_at).getTime() <= now.getTime()) return "expired"
  return "active"
}

function applyStatusFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  status: AdminPromoCodeStatusFilter,
  nowIso: string,
) {
  switch (status) {
    case "active":
      return query
        .is("redeemed_at", null)
        .is("reserved_payment_intent_id", null)
        .gt("expires_at", nowIso)
    case "reserved":
      return query.is("redeemed_at", null).not("reserved_payment_intent_id", "is", null)
    case "redeemed":
      return query.not("redeemed_at", "is", null)
    case "expired":
      return query.is("redeemed_at", null).lte("expires_at", nowIso)
    default:
      return query
  }
}

export async function dbCountAdminPromoCodesByStatus(
  supabase: SupabaseClient,
  status: Exclude<AdminPromoCodeStatusFilter, "all">,
): Promise<{ count: number; error: string | null }> {
  const nowIso = new Date().toISOString()
  let query = supabase
    .from("newsletter_promo_codes")
    .select("*", { count: "exact", head: true })

  query = applyStatusFilter(query, status, nowIso)

  const { count, error } = await query
  if (error) return { count: 0, error: error.message }
  return { count: count ?? 0, error: null }
}

export async function dbFetchAdminPromoCodeStats(
  supabase: SupabaseClient,
): Promise<{ stats: AdminPromoCodeStats | null; error: string | null }> {
  const [total, active, reserved, redeemed, expired, discountSum] = await Promise.all([
    supabase.from("newsletter_promo_codes").select("*", { count: "exact", head: true }),
    dbCountAdminPromoCodesByStatus(supabase, "active"),
    dbCountAdminPromoCodesByStatus(supabase, "reserved"),
    dbCountAdminPromoCodesByStatus(supabase, "redeemed"),
    dbCountAdminPromoCodesByStatus(supabase, "expired"),
    supabase
      .from("orders")
      .select("promo_discount_usd")
      .not("promo_code_id", "is", null)
      .gt("promo_discount_usd", 0),
  ])

  if (total.error) return { stats: null, error: total.error.message }
  if (active.error) return { stats: null, error: active.error }
  if (reserved.error) return { stats: null, error: reserved.error }
  if (redeemed.error) return { stats: null, error: redeemed.error }
  if (expired.error) return { stats: null, error: expired.error }
  if (discountSum.error) return { stats: null, error: discountSum.error.message }

  const totalDiscountUsd = (discountSum.data ?? []).reduce((sum, row) => {
    const value = Number(row.promo_discount_usd ?? 0)
    return sum + (Number.isFinite(value) ? value : 0)
  }, 0)

  return {
    stats: {
      totalIssued: total.count ?? 0,
      active: active.count,
      reserved: reserved.count,
      redeemed: redeemed.count,
      expired: expired.count,
      totalDiscountUsd: Math.round(totalDiscountUsd * 100) / 100,
    },
    error: null,
  }
}

export async function dbSearchPromoOrderIdsByTerm(
  supabase: SupabaseClient,
  term: string,
): Promise<{ orderIds: string[]; error: string | null }> {
  const trimmed = term.trim()
  if (!trimmed) return { orderIds: [], error: null }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  let query = supabase
    .from("orders")
    .select("id")
    .not("promo_code_id", "is", null)
    .limit(50)

  if (uuidPattern.test(trimmed)) {
    query = query.eq("id", trimmed)
  } else {
    query = query.ilike("order_num", `%${trimmed}%`)
  }

  const { data, error } = await query
  if (error) return { orderIds: [], error: error.message }
  return { orderIds: (data ?? []).map((row) => row.id as string), error: null }
}

export async function dbListAdminPromoCodes(
  supabase: SupabaseClient,
  params: {
    status: AdminPromoCodeStatusFilter
    q?: string
    sort: AdminPromoCodeSortKey
    dir: "asc" | "desc"
    limit: number
    offset: number
    redeemedOrderIds?: string[]
  },
): Promise<{ rows: NewsletterPromoCodeRow[]; total: number; error: string | null }> {
  const nowIso = new Date().toISOString()
  const q = params.q?.trim() ?? ""

  let query = supabase
    .from("newsletter_promo_codes")
    .select(PROMO_SELECT, { count: "exact" })

  query = applyStatusFilter(query, params.status, nowIso)

  const orParts: string[] = []
  if (q) {
    orParts.push(`code.ilike.%${q}%`, `email.ilike.%${q}%`)
  }
  if (params.redeemedOrderIds && params.redeemedOrderIds.length > 0) {
    orParts.push(`redeemed_order_id.in.(${params.redeemedOrderIds.join(",")})`)
  }
  if (orParts.length > 0) {
    query = query.or(orParts.join(","))
  }

  const ascending = params.dir === "asc"
  query = query.order(params.sort, { ascending }).range(params.offset, params.offset + params.limit - 1)

  const { data, count, error } = await query
  if (error) return { rows: [], total: 0, error: error.message }

  return {
    rows: (data as NewsletterPromoCodeRow[]) ?? [],
    total: count ?? 0,
    error: null,
  }
}

export async function dbFetchAdminPromoOrdersByIds(
  supabase: SupabaseClient,
  orderIds: string[],
): Promise<{ rows: AdminPromoOrderRow[]; error: string | null }> {
  if (orderIds.length === 0) return { rows: [], error: null }

  const { data, error } = await supabase
    .from("orders")
    .select("id, order_num, amount, promo_discount_usd, status, created_at, promo_code_id")
    .in("id", orderIds)

  if (error) return { rows: [], error: error.message }
  return { rows: (data as AdminPromoOrderRow[]) ?? [], error: null }
}

export { resolvePromoStatus }
