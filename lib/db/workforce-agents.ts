import type { SupabaseClient } from "@supabase/supabase-js"

import { WORKFORCE_AGENT_CATALOG } from "@/lib/workforce-agents/catalog"
import type {
  WorkforceAgentId,
  WorkforceAgentRow,
  WorkforceAgentRunRow,
  WorkforceRunStatus,
  WorkforceTriggeredBy,
} from "@/lib/workforce-agents/types"

export async function listWorkforceAgentRows(
  supabase: SupabaseClient,
): Promise<WorkforceAgentRow[]> {
  const { data, error } = await supabase
    .from("workforce_agents")
    .select(
      "id, enabled, last_run_at, last_run_status, last_run_summary, updated_by, created_at, updated_at",
    )
    .order("id")

  if (error) {
    console.error("listWorkforceAgentRows:", error.message)
    throw new Error(error.message || "Could not load workforce agents")
  }

  return (data ?? []) as WorkforceAgentRow[]
}

export async function ensureWorkforceAgentRows(
  supabase: SupabaseClient,
): Promise<void> {
  const existing = await listWorkforceAgentRows(supabase)
  const have = new Set(existing.map((row) => row.id))
  const missing = WORKFORCE_AGENT_CATALOG.map((agent) => agent.id).filter(
    (id) => !have.has(id),
  )
  if (missing.length === 0) return

  const { error } = await supabase.from("workforce_agents").upsert(
    missing.map((id) => ({ id, enabled: false })),
    { onConflict: "id", ignoreDuplicates: true },
  )
  if (error) {
    console.error("ensureWorkforceAgentRows:", error.message)
    throw new Error(error.message || "Could not seed workforce agents")
  }
}

export async function getWorkforceAgentRow(
  supabase: SupabaseClient,
  id: WorkforceAgentId,
): Promise<WorkforceAgentRow | null> {
  const { data, error } = await supabase
    .from("workforce_agents")
    .select(
      "id, enabled, last_run_at, last_run_status, last_run_summary, updated_by, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("getWorkforceAgentRow:", error.message)
    throw new Error(error.message || "Could not load agent")
  }
  return (data as WorkforceAgentRow | null) ?? null
}

export async function setWorkforceAgentEnabled(
  supabase: SupabaseClient,
  id: WorkforceAgentId,
  enabled: boolean,
  updatedBy: string | null,
): Promise<WorkforceAgentRow> {
  const { data, error } = await supabase
    .from("workforce_agents")
    .update({ enabled, updated_by: updatedBy })
    .eq("id", id)
    .select(
      "id, enabled, last_run_at, last_run_status, last_run_summary, updated_by, created_at, updated_at",
    )
    .single()

  if (error) {
    console.error("setWorkforceAgentEnabled:", error.message)
    throw new Error(error.message || "Could not update agent")
  }
  return data as WorkforceAgentRow
}

export async function listRecentWorkforceAgentRuns(
  supabase: SupabaseClient,
  limitPerAgent = 3,
): Promise<WorkforceAgentRunRow[]> {
  const { data, error } = await supabase
    .from("workforce_agent_runs")
    .select("id, agent_id, status, summary, detail, triggered_by, created_at")
    .order("created_at", { ascending: false })
    .limit(Math.max(limitPerAgent * WORKFORCE_AGENT_CATALOG.length, 40))

  if (error) {
    console.error("listRecentWorkforceAgentRuns:", error.message)
    throw new Error(error.message || "Could not load agent runs")
  }

  const rows = (data ?? []) as WorkforceAgentRunRow[]
  const counts = new Map<string, number>()
  const trimmed: WorkforceAgentRunRow[] = []
  for (const row of rows) {
    const n = counts.get(row.agent_id) ?? 0
    if (n >= limitPerAgent) continue
    counts.set(row.agent_id, n + 1)
    trimmed.push({
      ...row,
      detail:
        row.detail && typeof row.detail === "object"
          ? (row.detail as Record<string, unknown>)
          : {},
    })
  }
  return trimmed
}

export async function insertWorkforceAgentRun(
  supabase: SupabaseClient,
  input: {
    agentId: WorkforceAgentId
    status: WorkforceRunStatus
    summary: string
    detail?: Record<string, unknown>
    triggeredBy: WorkforceTriggeredBy
  },
): Promise<WorkforceAgentRunRow> {
  const { data, error } = await supabase
    .from("workforce_agent_runs")
    .insert({
      agent_id: input.agentId,
      status: input.status,
      summary: input.summary,
      detail: input.detail ?? {},
      triggered_by: input.triggeredBy,
    })
    .select("id, agent_id, status, summary, detail, triggered_by, created_at")
    .single()

  if (error) {
    console.error("insertWorkforceAgentRun:", error.message)
    throw new Error(error.message || "Could not record agent run")
  }

  const row = data as WorkforceAgentRunRow
  return {
    ...row,
    detail:
      row.detail && typeof row.detail === "object"
        ? (row.detail as Record<string, unknown>)
        : {},
  }
}

export async function updateWorkforceAgentLastRun(
  supabase: SupabaseClient,
  id: WorkforceAgentId,
  input: {
    status: WorkforceRunStatus
    summary: string
    ranAt: string
  },
): Promise<void> {
  const { error } = await supabase
    .from("workforce_agents")
    .update({
      last_run_at: input.ranAt,
      last_run_status: input.status,
      last_run_summary: input.summary,
    })
    .eq("id", id)

  if (error) {
    console.error("updateWorkforceAgentLastRun:", error.message)
    throw new Error(error.message || "Could not update last run")
  }
}
