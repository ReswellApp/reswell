import {
  dbFetchAdminPromoCodeStats,
  dbFetchAdminPromoOrdersByIds,
  dbListAdminPromoCodes,
  dbSearchPromoOrderIdsByTerm,
  resolvePromoStatus,
} from "@/lib/db/adminPromoCodes"
import type { NewsletterPromoCodeRow } from "@/lib/db/newsletterPromoCodes"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type {
  AdminPromoCodeListRow,
  AdminPromoCodeSortKey,
  AdminPromoCodeStatusFilter,
  AdminPromoCodesListResult,
  AdminPromoCodeStats,
} from "@/lib/types/admin-promo-codes"

function getServiceOrThrow(): ReturnType<typeof createServiceRoleClient> | null {
  try {
    return createServiceRoleClient()
  } catch {
    return null
  }
}

function toNumber(value: number | string | null | undefined): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

export async function listAdminPromoCodes(params: {
  status?: AdminPromoCodeStatusFilter
  q?: string
  sort?: AdminPromoCodeSortKey
  dir?: "asc" | "desc"
  limit?: number
  offset?: number
}): Promise<
  | { ok: true; data: AdminPromoCodesListResult }
  | { ok: false; message: string; status: number }
> {
  const supabase = getServiceOrThrow()
  if (!supabase) {
    return { ok: false, message: "Server misconfigured", status: 500 }
  }

  const status = params.status ?? "all"
  const sort = params.sort ?? "created_at"
  const dir = params.dir ?? "desc"
  const limit = params.limit ?? 50
  const offset = params.offset ?? 0
  const q = params.q?.trim() ?? ""

  const statsResult = await dbFetchAdminPromoCodeStats(supabase)
  if (statsResult.error || !statsResult.stats) {
    console.error("[admin promo codes] stats:", statsResult.error)
    return { ok: false, message: "Could not load promo stats", status: 500 }
  }

  let redeemedOrderIds: string[] | undefined
  if (q) {
    const orderSearch = await dbSearchPromoOrderIdsByTerm(supabase, q)
    if (orderSearch.error) {
      console.error("[admin promo codes] order search:", orderSearch.error)
      return { ok: false, message: "Could not search orders", status: 500 }
    }
    if (orderSearch.orderIds.length > 0) {
      redeemedOrderIds = orderSearch.orderIds
    }
  }

  const listResult = await dbListAdminPromoCodes(supabase, {
    status,
    q: q || undefined,
    sort,
    dir,
    limit,
    offset,
    redeemedOrderIds,
  })

  return buildListResult(supabase, listResult, statsResult.stats)
}

async function buildListResult(
  supabase: ReturnType<typeof createServiceRoleClient>,
  listResult: { rows: NewsletterPromoCodeRow[]; total: number; error: string | null },
  stats: AdminPromoCodeStats,
): Promise<
  | { ok: true; data: AdminPromoCodesListResult }
  | { ok: false; message: string; status: number }
> {
  if (listResult.error) {
    console.error("[admin promo codes] list:", listResult.error)
    return { ok: false, message: "Could not load promo codes", status: 500 }
  }

  const orderIds = listResult.rows
    .map((row) => row.redeemed_order_id)
    .filter((id): id is string => Boolean(id?.trim()))

  const ordersResult = await dbFetchAdminPromoOrdersByIds(supabase, orderIds)
  if (ordersResult.error) {
    console.error("[admin promo codes] orders:", ordersResult.error)
    return { ok: false, message: "Could not load order details", status: 500 }
  }

  const orderById = new Map(ordersResult.rows.map((row) => [row.id, row] as const))

  const rows: AdminPromoCodeListRow[] = listResult.rows.map((row) => {
    const orderRow = row.redeemed_order_id ? orderById.get(row.redeemed_order_id) ?? null : null
    return {
      id: row.id,
      email: row.email,
      code: row.code,
      discountPercent: row.discount_percent,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      redeemedAt: row.redeemed_at,
      reservedPaymentIntentId: row.reserved_payment_intent_id,
      status: resolvePromoStatus(row),
      order: orderRow
        ? {
            id: orderRow.id,
            orderNum: formatOrderNumForCustomer(orderRow.order_num, orderRow.id),
            amount: toNumber(orderRow.amount),
            promoDiscountUsd: toNumber(orderRow.promo_discount_usd),
            status: orderRow.status,
            createdAt: orderRow.created_at,
          }
        : null,
    }
  })

  return {
    ok: true,
    data: {
      rows,
      total: listResult.total,
      stats,
    },
  }
}
