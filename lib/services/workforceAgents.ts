import { requireAdmin } from "@/lib/brands/admin-server"
import {
  ensureWorkforceAgentRows,
  getWorkforceAgentRow,
  insertWorkforceAgentRun,
  listRecentWorkforceAgentRuns,
  listWorkforceAgentRows,
  setWorkforceAgentEnabled,
  updateWorkforceAgentLastRun,
} from "@/lib/db/workforce-agents"
import {
  WORKFORCE_AGENT_CATALOG,
  getWorkforceAgentDefinition,
} from "@/lib/workforce-agents/catalog"
import { WORKFORCE_AGENT_RUNNERS } from "@/lib/workforce-agents/runners"
import type {
  WorkforceAgentAdminView,
  WorkforceAgentId,
  WorkforceAgentRunRow,
  WorkforceTriggeredBy,
} from "@/lib/workforce-agents/types"
import { createServiceRoleClient } from "@/lib/supabase/server"

type Ok<T> = { ok: true; data: T }
type Err = { ok: false; error: string }

function loggedFailure(error: unknown, fallback: string): Err {
  const message = error instanceof Error ? error.message : fallback
  console.error("workforceAgents:", message)
  return { ok: false, error: message || fallback }
}

function mergeAdminViews(
  rows: Awaited<ReturnType<typeof listWorkforceAgentRows>>,
  runs: WorkforceAgentRunRow[],
): WorkforceAgentAdminView[] {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const runsByAgent = new Map<string, WorkforceAgentRunRow[]>()
  for (const run of runs) {
    const list = runsByAgent.get(run.agent_id) ?? []
    list.push(run)
    runsByAgent.set(run.agent_id, list)
  }

  return WORKFORCE_AGENT_CATALOG.map((def) => {
    const row = byId.get(def.id)
    return {
      ...def,
      enabled: row?.enabled ?? false,
      lastRunAt: row?.last_run_at ?? null,
      lastRunStatus: row?.last_run_status ?? "idle",
      lastRunSummary: row?.last_run_summary ?? null,
      updatedAt: row?.updated_at ?? null,
      recentRuns: runsByAgent.get(def.id) ?? [],
    }
  })
}

export async function getWorkforceAgentsAdminPage(): Promise<
  Ok<{ agents: WorkforceAgentAdminView[] }> | Err
> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  try {
    const db = createServiceRoleClient()
    await ensureWorkforceAgentRows(db)
    const [rows, runs] = await Promise.all([
      listWorkforceAgentRows(db),
      listRecentWorkforceAgentRuns(db, 3),
    ])
    return { ok: true, data: { agents: mergeAdminViews(rows, runs) } }
  } catch (error) {
    return loggedFailure(error, "Could not load workforce agents")
  }
}

export async function toggleWorkforceAgent(input: {
  agentId: WorkforceAgentId
  enabled: boolean
}): Promise<Ok<{ enabled: boolean }> | Err> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }

  if (!getWorkforceAgentDefinition(input.agentId)) {
    return { ok: false, error: "Unknown agent" }
  }

  try {
    const db = createServiceRoleClient()
    await ensureWorkforceAgentRows(db)
    const row = await setWorkforceAgentEnabled(
      db,
      input.agentId,
      input.enabled,
      gate.ctx.user.id,
    )
    return { ok: true, data: { enabled: row.enabled } }
  } catch (error) {
    return loggedFailure(error, "Could not update agent")
  }
}

export async function executeWorkforceAgent(input: {
  agentId: WorkforceAgentId
  triggeredBy: WorkforceTriggeredBy
  /** When true, skip the enabled check (admin Run now still requires enabled in UI, but cron uses this). */
  requireEnabled?: boolean
}): Promise<
  Ok<{ status: string; summary: string; runId: string }> | Err
> {
  const requireEnabled = input.requireEnabled !== false
  const runner = WORKFORCE_AGENT_RUNNERS[input.agentId]
  if (!runner) return { ok: false, error: "Unknown agent" }

  try {
    const db = createServiceRoleClient()
    await ensureWorkforceAgentRows(db)
    const row = await getWorkforceAgentRow(db, input.agentId)
    if (!row) return { ok: false, error: "Agent not found" }

    if (requireEnabled && !row.enabled) {
      const skippedSummary = "Agent is turned off"
      const run = await insertWorkforceAgentRun(db, {
        agentId: input.agentId,
        status: "skipped",
        summary: skippedSummary,
        detail: { reason: "disabled" },
        triggeredBy: input.triggeredBy,
      })
      await updateWorkforceAgentLastRun(db, input.agentId, {
        status: "skipped",
        summary: skippedSummary,
        ranAt: run.created_at,
      })
      return {
        ok: true,
        data: { status: "skipped", summary: skippedSummary, runId: run.id },
      }
    }

    const result = await runner(db)
    const run = await insertWorkforceAgentRun(db, {
      agentId: input.agentId,
      status: result.status,
      summary: result.summary,
      detail: result.detail,
      triggeredBy: input.triggeredBy,
    })
    await updateWorkforceAgentLastRun(db, input.agentId, {
      status: result.status,
      summary: result.summary,
      ranAt: run.created_at,
    })
    return {
      ok: true,
      data: { status: result.status, summary: result.summary, runId: run.id },
    }
  } catch (error) {
    return loggedFailure(error, "Agent run failed")
  }
}

export async function runWorkforceAgentAsAdmin(input: {
  agentId: WorkforceAgentId
}): Promise<Ok<{ status: string; summary: string; runId: string }> | Err> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: "Admin only" }
  return executeWorkforceAgent({
    agentId: input.agentId,
    triggeredBy: "manual",
    requireEnabled: true,
  })
}

/** Cron: run every agent that is currently enabled. */
export async function runEnabledWorkforceAgentsFromCron(): Promise<{
  ran: number
  skipped: number
  errors: string[]
  results: { agentId: WorkforceAgentId; status: string; summary: string }[]
}> {
  const db = createServiceRoleClient()
  await ensureWorkforceAgentRows(db)
  const rows = await listWorkforceAgentRows(db)
  const enabled = rows.filter((row) => row.enabled)

  const results: { agentId: WorkforceAgentId; status: string; summary: string }[] = []
  const errors: string[] = []
  let skipped = rows.length - enabled.length

  for (const row of enabled) {
    const outcome = await executeWorkforceAgent({
      agentId: row.id,
      triggeredBy: "cron",
      requireEnabled: true,
    })
    if (!outcome.ok) {
      errors.push(`${row.id}: ${outcome.error}`)
      continue
    }
    if (outcome.data.status === "skipped") skipped += 1
    results.push({
      agentId: row.id,
      status: outcome.data.status,
      summary: outcome.data.summary,
    })
  }

  return { ran: results.length, skipped, errors, results }
}

export async function isWorkforceAgentEnabled(
  agentId: WorkforceAgentId,
): Promise<boolean> {
  try {
    const db = createServiceRoleClient()
    const row = await getWorkforceAgentRow(db, agentId)
    return row?.enabled === true
  } catch {
    return false
  }
}
