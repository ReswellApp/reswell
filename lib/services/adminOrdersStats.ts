import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  dbGetAdminOrderStatusCounts,
  isPostgrestSchemaStaleError,
  type AdminOrderStatusCounts,
} from "@/lib/db/adminOrders"

export type AdminOrdersStatsResult =
  | { ok: true; data: AdminOrderStatusCounts }
  | { ok: false; message: string; status: number }

function getServiceOrThrow(): ReturnType<typeof createServiceRoleClient> | null {
  try {
    return createServiceRoleClient()
  } catch {
    return null
  }
}

/** Status-count KPIs for the admin orders page. Uses count-only queries (scales to large tables). */
export async function getAdminOrdersStats(): Promise<AdminOrdersStatsResult> {
  const supabase = getServiceOrThrow()
  if (!supabase) {
    return { ok: false, message: "Server misconfigured", status: 500 }
  }

  const { data, error } = await dbGetAdminOrderStatusCounts(supabase)
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

  return { ok: true, data: data ?? { total: 0, confirmed: 0, pending: 0, refunding: 0, refunded: 0 } }
}
