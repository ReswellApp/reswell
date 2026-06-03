import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  listSearchInsightActions,
  listStaffAssignees,
  upsertSearchInsightAction,
  type SearchInsightActionRow,
} from "@/lib/db/searchInsightActions"
import type { UpsertSearchInsightActionInput } from "@/lib/validations/search-insight-actions"

export type SearchInsightActionDto = {
  insightId: string
  status: SearchInsightActionRow["status"]
  snoozeUntil: string | null
  assigneeId: string | null
  dueDate: string | null
  note: string | null
  updatedBy: string | null
  updatedAt: string
}

export type SearchInsightActionAssignee = {
  id: string
  name: string
}

export type SearchInsightActionsSnapshot = {
  actions: SearchInsightActionDto[]
  assignees: SearchInsightActionAssignee[]
}

function toDto(row: SearchInsightActionRow): SearchInsightActionDto {
  return {
    insightId: row.insight_id,
    status: row.status,
    snoozeUntil: row.snooze_until,
    assigneeId: row.assignee_id,
    dueDate: row.due_date,
    note: row.note,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  }
}

/** Current shared triage state + the staff list usable as assignees. */
export async function getSearchInsightActionsSnapshot(
  supabase: SupabaseClient,
): Promise<SearchInsightActionsSnapshot> {
  // Assignee list uses the service role (route is already staff-gated) so it
  // isn't constrained by per-row profiles RLS.
  const assigneeClient: SupabaseClient = (() => {
    try {
      return createServiceRoleClient()
    } catch {
      return supabase
    }
  })()

  const [{ rows: actionRows }, { rows: staffRows }] = await Promise.all([
    listSearchInsightActions(supabase),
    listStaffAssignees(assigneeClient),
  ])

  return {
    actions: actionRows.map(toDto),
    assignees: staffRows.map((s) => ({
      id: s.id,
      name: s.display_name?.trim() || "Teammate",
    })),
  }
}

export async function saveSearchInsightAction(
  supabase: SupabaseClient,
  input: UpsertSearchInsightActionInput,
  updatedBy: string,
): Promise<{ action: SearchInsightActionDto | null; error: string | null }> {
  const { row, error } = await upsertSearchInsightAction(supabase, {
    insightId: input.insightId,
    status: input.status,
    snoozeUntil: input.snoozeUntil ?? null,
    assigneeId: input.assigneeId ?? null,
    dueDate: input.dueDate ?? null,
    note: input.note ?? null,
    updatedBy,
  })

  if (error) {
    console.error("saveSearchInsightAction:", error.message)
    return { action: null, error: "Could not save. Try again." }
  }

  return { action: row ? toDto(row) : null, error: null }
}
