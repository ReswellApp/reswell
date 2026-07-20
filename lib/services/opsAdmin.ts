import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  getOpsGroupById,
  insertOpsFixTicket,
  listOpsGroups,
  listOpsSignalsForGroup,
  listOpsTicketsForGroup,
  listRecentOpsIngestRuns,
  updateOpsFixTicket,
  updateOpsGroupStatus,
} from "@/lib/db/ops"
import type { OpsFixTicketRow, OpsGroupRow, OpsIngestRunRow, OpsSignalRow } from "@/lib/types/ops"
import {
  opsCreateFixTicketSchema,
  opsUpdateFixTicketSchema,
  opsUpdateGroupStatusSchema,
} from "@/lib/validations/ops"
import { ingestVercelOpsLogs } from "@/lib/services/opsVercelIngest"
import { ingestSupabaseOpsLogs } from "@/lib/services/opsSupabaseIngest"

async function requireStaffUser(): Promise<
  | { ok: true; userId: string; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Sign in required" }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (error) return { ok: false, error: "Could not verify access" }
  if (!profile?.is_admin && !profile?.is_employee) {
    return { ok: false, error: "Forbidden" }
  }
  return { ok: true, userId: user.id, supabase }
}

export async function listOpsGroupsService(filters: {
  status?: string
  source?: string
  q?: string
}): Promise<{ data: OpsGroupRow[] } | { error: string }> {
  const gate = await requireStaffUser()
  if (!gate.ok) return { error: gate.error }

  try {
    const data = await listOpsGroups(gate.supabase, {
      status: (filters.status as "all" | OpsGroupRow["status"] | undefined) ?? "all",
      source: (filters.source as "all" | OpsGroupRow["source"] | undefined) ?? "all",
      q: filters.q,
      limit: 150,
    })
    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load groups" }
  }
}

export async function getOpsGroupDetailService(
  groupId: string,
): Promise<
  | {
      data: {
        group: OpsGroupRow
        signals: OpsSignalRow[]
        tickets: OpsFixTicketRow[]
      }
    }
  | { error: string }
> {
  const gate = await requireStaffUser()
  if (!gate.ok) return { error: gate.error }

  try {
    const group = await getOpsGroupById(gate.supabase, groupId)
    if (!group) return { error: "Not found" }
    const [signals, tickets] = await Promise.all([
      listOpsSignalsForGroup(gate.supabase, groupId, 75),
      listOpsTicketsForGroup(gate.supabase, groupId),
    ])
    return { data: { group, signals, tickets } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load detail" }
  }
}

export async function listOpsIngestRunsService(): Promise<
  { data: OpsIngestRunRow[] } | { error: string }
> {
  const gate = await requireStaffUser()
  if (!gate.ok) return { error: gate.error }
  try {
    const data = await listRecentOpsIngestRuns(gate.supabase, 30)
    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load ingest runs" }
  }
}

export async function updateOpsGroupStatusService(
  raw: unknown,
): Promise<{ success: true; data: OpsGroupRow } | { error: string }> {
  const gate = await requireStaffUser()
  if (!gate.ok) return { error: gate.error }

  const parsed = opsUpdateGroupStatusSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid input" }

  try {
    const data = await updateOpsGroupStatus(
      gate.supabase,
      parsed.data.groupId,
      parsed.data.status,
    )
    revalidatePath("/admin/ops")
    revalidatePath(`/admin/ops/${parsed.data.groupId}`)
    return { success: true, data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Update failed" }
  }
}

export async function createOpsFixTicketService(
  raw: unknown,
): Promise<{ success: true; data: OpsFixTicketRow } | { error: string }> {
  const gate = await requireStaffUser()
  if (!gate.ok) return { error: gate.error }

  const parsed = opsCreateFixTicketSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid input" }

  try {
    const group = await getOpsGroupById(gate.supabase, parsed.data.groupId)
    if (!group) return { error: "Group not found" }

    const data = await insertOpsFixTicket(gate.supabase, {
      groupId: parsed.data.groupId,
      title: parsed.data.title,
      notes: parsed.data.notes,
      priority: parsed.data.priority,
      createdBy: gate.userId,
    })

    if (group.status === "open") {
      await updateOpsGroupStatus(gate.supabase, group.id, "acknowledged")
    }

    revalidatePath("/admin/ops")
    revalidatePath(`/admin/ops/${parsed.data.groupId}`)
    return { success: true, data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create ticket" }
  }
}

export async function updateOpsFixTicketService(
  raw: unknown,
): Promise<{ success: true; data: OpsFixTicketRow } | { error: string }> {
  const gate = await requireStaffUser()
  if (!gate.ok) return { error: gate.error }

  const parsed = opsUpdateFixTicketSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid input" }

  try {
    const data = await updateOpsFixTicket(gate.supabase, parsed.data.ticketId, {
      status: parsed.data.status,
      notes: parsed.data.notes,
      priority: parsed.data.priority,
    })
    revalidatePath("/admin/ops")
    revalidatePath(`/admin/ops/${data.group_id}`)
    return { success: true, data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not update ticket" }
  }
}

export async function runOpsIngestNowService(input?: {
  vercelHours?: number
  supabaseHours?: number
}): Promise<
  | {
      success: true
      data: {
        vercel: Awaited<ReturnType<typeof ingestVercelOpsLogs>>
        supabase: Awaited<ReturnType<typeof ingestSupabaseOpsLogs>>
      }
    }
  | { error: string }
> {
  const gate = await requireStaffUser()
  if (!gate.ok) return { error: gate.error }

  const vercel = await ingestVercelOpsLogs({
    sinceHours: input?.vercelHours ?? 2,
    environment: "production",
  })
  const supabase = await ingestSupabaseOpsLogs({
    sinceHours: input?.supabaseHours ?? 1,
  })

  revalidatePath("/admin/ops")
  return { success: true, data: { vercel, supabase } }
}
