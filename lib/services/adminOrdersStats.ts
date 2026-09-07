import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  dbGetAdminOrdersDashboard,
  isPostgrestSchemaStaleError,
  type AdminOrdersDashboardPayload,
  type AdminOrdersDashboardStats,
  type AdminOrdersDashboardQueues,
  type AdminOrdersOpsOrderRow,
  type AdminOrdersOpsLabelRow,
  type AdminOrdersOpenLists,
} from "@/lib/db/adminOrders"

export type {
  AdminOrdersDashboardPayload,
  AdminOrdersDashboardStats,
  AdminOrdersDashboardQueues,
  AdminOrdersOpsOrderRow,
  AdminOrdersOpsLabelRow,
  AdminOrdersOpenLists,
}

export type AdminOrdersStatsResult =
  | { ok: true; data: AdminOrdersDashboardPayload }
  | { ok: false; message: string; status: number }

function getServiceOrThrow(): ReturnType<typeof createServiceRoleClient> | null {
  try {
    return createServiceRoleClient()
  } catch {
    return null
  }
}

const EMPTY_STATS: AdminOrdersDashboardStats = {
  total: 0,
  confirmed: 0,
  pending: 0,
  refunding: 0,
  refunded: 0,
  openUnfulfilled: 0,
  openByStage: {
    awaiting_shipment: 0,
    shipped: 0,
    pickup_ready: 0,
  },
  openByMethod: { shipping: 0, pickup: 0 },
  openByAge: [
    { key: "under_1d", label: "< 1 day", count: 0 },
    { key: "1_3d", label: "1–3 days", count: 0 },
    { key: "3_7d", label: "3–7 days", count: 0 },
    { key: "7_14d", label: "7–14 days", count: 0 },
    { key: "over_14d", label: "14+ days", count: 0 },
  ],
  needsLabel: 0,
  openLabels: 0,
  openLabelFailures: 0,
}

const EMPTY_QUEUES: AdminOrdersDashboardQueues = {
  openOrders: [],
  openLabels: [],
}

const EMPTY_OPEN_LISTS: AdminOrdersOpenLists = {
  shipping: [],
  pickup: [],
}

/** Dashboard KPIs, open-fulfillment breakdown, and attention queues for `/admin/orders`. */
export async function getAdminOrdersStats(): Promise<AdminOrdersStatsResult> {
  const supabase = getServiceOrThrow()
  if (!supabase) {
    return { ok: false, message: "Server misconfigured", status: 500 }
  }

  const { data, error } = await dbGetAdminOrdersDashboard(supabase)
  if (error) {
    if (isPostgrestSchemaStaleError(error)) {
      return {
        ok: false,
        message:
          "Database API schema is out of date (often after a migration). Reload the schema in Supabase and try again.",
        status: 503,
      }
    }
    console.error("[admin orders stats]", error)
    return { ok: false, message: "Could not load order stats", status: 500 }
  }

  return {
    ok: true,
    data: data ?? { stats: EMPTY_STATS, queues: EMPTY_QUEUES, openLists: EMPTY_OPEN_LISTS },
  }
}
