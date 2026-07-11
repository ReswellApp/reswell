import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  dbGetAdminRefundThreadNotificationStats,
  dbListAdminRefundThreadNotifications,
  type AdminRefundThreadNotificationListItem,
  type AdminRefundThreadNotificationStats,
} from "@/lib/db/adminRefundThreadNotifications"

export type PartyLabel = {
  display_name: string | null
  email: string | null
  avatar_url: string | null
}

export type AdminRefundThreadNotificationRow = AdminRefundThreadNotificationListItem & {
  buyer: PartyLabel | null
  seller: PartyLabel | null
}

export type AdminRefundThreadNotificationsListResult =
  | { ok: true; data: AdminRefundThreadNotificationRow[]; total: number }
  | { ok: false; message: string; status: number }

export type AdminRefundThreadNotificationsStatsResult =
  | { ok: true; data: AdminRefundThreadNotificationStats }
  | { ok: false; message: string; status: number }

function getServiceOrThrow(): ReturnType<typeof createServiceRoleClient> | null {
  try {
    return createServiceRoleClient()
  } catch {
    return null
  }
}

async function loadPartyLabels(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userIds: string[],
): Promise<Map<string, PartyLabel>> {
  const map = new Map<string, PartyLabel>()
  if (userIds.length === 0) return map

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, email, avatar_url")
    .in("id", userIds)

  for (const p of profiles ?? []) {
    map.set(p.id as string, {
      display_name: (p.display_name as string | null) ?? null,
      email: (p.email as string | null) ?? null,
      avatar_url: (p.avatar_url as string | null) ?? null,
    })
  }

  return map
}

export async function getAdminRefundThreadNotificationsStats(): Promise<AdminRefundThreadNotificationsStatsResult> {
  const supabase = getServiceOrThrow()
  if (!supabase) {
    return { ok: false, message: "Server misconfigured", status: 500 }
  }

  const { data, error } = await dbGetAdminRefundThreadNotificationStats(supabase)
  if (error || !data) {
    console.error("[admin refund thread notifications stats]", error)
    return { ok: false, message: "Could not load refund notification stats", status: 500 }
  }

  return { ok: true, data }
}

export async function listAdminRefundThreadNotifications(opts: {
  limit: number
  offset: number
  q?: string
  userId?: string
}): Promise<AdminRefundThreadNotificationsListResult> {
  const supabase = getServiceOrThrow()
  if (!supabase) {
    return { ok: false, message: "Server misconfigured", status: 500 }
  }

  const { data, total, error } = await dbListAdminRefundThreadNotifications(supabase, opts)
  if (error) {
    console.error("[admin refund thread notifications list]", error)
    return { ok: false, message: "Could not load refund notifications", status: 500 }
  }

  const partyIds = Array.from(
    new Set(data.flatMap((row) => [row.buyerId, row.sellerId]).filter(Boolean)),
  )
  const partyById = await loadPartyLabels(supabase, partyIds)

  const enriched: AdminRefundThreadNotificationRow[] = data.map((row) => ({
    ...row,
    buyer: partyById.get(row.buyerId) ?? null,
    seller: partyById.get(row.sellerId) ?? null,
  }))

  return { ok: true, data: enriched, total }
}
