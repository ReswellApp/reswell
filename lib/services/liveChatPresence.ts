import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import {
  countFreshLiveChatAgents,
  listFreshLiveChatAgentPresence,
  upsertLiveChatAgentPresence,
} from "@/lib/db/liveChatPresence"
import { getLiveChatStaffProfileService } from "@/lib/services/liveChatAdmin"

export async function heartbeatLiveChatAgentPresenceService(): Promise<
  { success: true } | { error: string }
> {
  const staff = await getLiveChatStaffProfileService()
  if ("error" in staff) return { error: staff.error }

  const supabase = await createClient()
  const ok = await upsertLiveChatAgentPresence(supabase, staff.userId, staff.displayName)
  if (!ok) return { error: "Could not update presence" }
  return { success: true }
}

export async function listOnlineLiveChatAgentsService(): Promise<
  { success: true; agents: Array<{ userId: string; displayName: string }> } | { error: string }
> {
  const staff = await getLiveChatStaffProfileService()
  if ("error" in staff) return { error: staff.error }

  const supabase = await createClient()
  const rows = await listFreshLiveChatAgentPresence(supabase)
  return {
    success: true,
    agents: rows.map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
    })),
  }
}

export async function areLiveChatAgentsOnlineService(): Promise<boolean> {
  try {
    const svc = createServiceRoleClient()
    return (await countFreshLiveChatAgents(svc)) > 0
  } catch {
    return false
  }
}

export async function getLiveChatSupportOnlineCountService(): Promise<number> {
  try {
    const svc = createServiceRoleClient()
    return await countFreshLiveChatAgents(svc)
  } catch {
    return 0
  }
}

export async function listLiveChatSupportOnlineMemberIdsService(): Promise<string[]> {
  try {
    const svc = createServiceRoleClient()
    const rows = await listFreshLiveChatAgentPresence(svc)
    return rows.map((row) => row.user_id)
  } catch {
    return []
  }
}
