import type { SupabaseClient } from "@supabase/supabase-js"
import type { SearchInsightStatus } from "@/lib/validations/search-insight-actions"

export type SearchInsightActionRow = {
  insight_id: string
  status: SearchInsightStatus
  snooze_until: string | null
  assignee_id: string | null
  due_date: string | null
  note: string | null
  updated_by: string | null
  updated_at: string
}

const ACTION_COLUMNS =
  "insight_id, status, snooze_until, assignee_id, due_date, note, updated_by, updated_at"

/** All shared insight-action rows (staff-gated by RLS). */
export async function listSearchInsightActions(
  supabase: SupabaseClient,
): Promise<{ rows: SearchInsightActionRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("search_insight_actions")
    .select(ACTION_COLUMNS)

  if (error) {
    return { rows: [], error: new Error(error.message) }
  }
  return { rows: (data ?? []) as SearchInsightActionRow[], error: null }
}

export type UpsertSearchInsightActionRow = {
  insightId: string
  status: SearchInsightStatus
  snoozeUntil: string | null
  assigneeId: string | null
  dueDate: string | null
  note: string | null
  updatedBy: string
}

/**
 * Idempotent upsert keyed by insight_id. When status resets to "open" with no
 * other metadata the row is deleted to keep the table to active triage only.
 */
export async function upsertSearchInsightAction(
  supabase: SupabaseClient,
  input: UpsertSearchInsightActionRow,
): Promise<{ row: SearchInsightActionRow | null; error: Error | null }> {
  const isCleanReset =
    input.status === "open" &&
    !input.snoozeUntil &&
    !input.assigneeId &&
    !input.dueDate &&
    !input.note

  if (isCleanReset) {
    const { error } = await supabase
      .from("search_insight_actions")
      .delete()
      .eq("insight_id", input.insightId)
    if (error) return { row: null, error: new Error(error.message) }
    return { row: null, error: null }
  }

  const { data, error } = await supabase
    .from("search_insight_actions")
    .upsert(
      {
        insight_id: input.insightId,
        status: input.status,
        snooze_until: input.snoozeUntil,
        assignee_id: input.assigneeId,
        due_date: input.dueDate,
        note: input.note,
        updated_by: input.updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "insight_id" },
    )
    .select(ACTION_COLUMNS)
    .maybeSingle()

  if (error) return { row: null, error: new Error(error.message) }
  return { row: (data as SearchInsightActionRow | null) ?? null, error: null }
}

export type StaffAssigneeRow = {
  id: string
  display_name: string | null
}

/** Admins + employees, for the assignee dropdown. */
export async function listStaffAssignees(
  supabase: SupabaseClient,
): Promise<{ rows: StaffAssigneeRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .or("is_admin.eq.true,is_employee.eq.true")
    .order("display_name", { ascending: true })

  if (error) {
    return { rows: [], error: new Error(error.message) }
  }
  return { rows: (data ?? []) as StaffAssigneeRow[], error: null }
}
