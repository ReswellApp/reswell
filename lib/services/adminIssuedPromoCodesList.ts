import {
  dbFetchAdminIssuedPromoCodeStats,
  dbFetchAdminIssuedPromoOrdersByIds,
  dbListAdminIssuedPromoCodes,
  dbSearchAdminIssuedPromoOrderIdsByTerm,
  resolveAdminIssuedPromoStatus,
} from "@/lib/db/adminIssuedPromoCodesList"
import type { AdminIssuedPromoCodeRow } from "@/lib/db/adminIssuedPromoCodes"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type {
  AdminIssuedPromoCodeListRow,
  AdminIssuedPromoCodeSortKey,
  AdminIssuedPromoCodeStats,
  AdminIssuedPromoCodeStatusFilter,
  AdminIssuedPromoCodesListResult,
} from "@/lib/types/admin-issued-promo-codes"

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

export async function listAdminIssuedPromoCodes(params: {
  status?: AdminIssuedPromoCodeStatusFilter
  q?: string
  sort?: AdminIssuedPromoCodeSortKey
  dir?: "asc" | "desc"
  limit?: number
  offset?: number
}): Promise<
  | { ok: true; data: AdminIssuedPromoCodesListResult }
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

  const statsResult = await dbFetchAdminIssuedPromoCodeStats(supabase)
  if (statsResult.error || !statsResult.stats) {
    console.error("[admin issued promo codes] stats:", statsResult.error)
    return { ok: false, message: "Could not load promo stats", status: 500 }
  }

  let redeemedOrderIds: string[] | undefined
  if (q) {
    const orderSearch = await dbSearchAdminIssuedPromoOrderIdsByTerm(supabase, q)
    if (orderSearch.error) {
      console.error("[admin issued promo codes] order search:", orderSearch.error)
      return { ok: false, message: "Could not search orders", status: 500 }
    }
    if (orderSearch.orderIds.length > 0) {
      redeemedOrderIds = orderSearch.orderIds
    }
  }

  const listResult = await dbListAdminIssuedPromoCodes(supabase, {
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
  listResult: { rows: AdminIssuedPromoCodeRow[]; total: number; error: string | null },
  stats: AdminIssuedPromoCodeStats,
): Promise<
  | { ok: true; data: AdminIssuedPromoCodesListResult }
  | { ok: false; message: string; status: number }
> {
  if (listResult.error) {
    console.error("[admin issued promo codes] list:", listResult.error)
    return { ok: false, message: "Could not load promo codes", status: 500 }
  }

  const orderIds = listResult.rows
    .map((row) => row.redeemed_order_id)
    .filter((id): id is string => Boolean(id?.trim()))

  const ordersResult = await dbFetchAdminIssuedPromoOrdersByIds(supabase, orderIds)
  if (ordersResult.error) {
    console.error("[admin issued promo codes] orders:", ordersResult.error)
    return { ok: false, message: "Could not load order details", status: 500 }
  }

  const orderById = new Map(ordersResult.rows.map((row) => [row.id, row] as const))

  const rows: AdminIssuedPromoCodeListRow[] = listResult.rows.map((row) => {
    const orderRow = row.redeemed_order_id ? orderById.get(row.redeemed_order_id) ?? null : null
    return {
      id: row.id,
      code: row.code,
      discountPercent: row.discount_percent,
      note: row.note,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      redeemedAt: row.redeemed_at,
      reservedPaymentIntentId: row.reserved_payment_intent_id,
      status: resolveAdminIssuedPromoStatus(row),
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
