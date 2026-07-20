import { createServiceRoleClient } from "@/lib/supabase/server"
import { insertOpsIngestRun } from "@/lib/db/ops"
import { recordOpsSignal } from "@/lib/services/opsIngest"
import type { OpsSeverity } from "@/lib/types/ops"

export type OpsSupabaseIngestResult = {
  status: "success" | "partial" | "failed" | "skipped"
  rangeHours: number
  rowsFetched: number
  signalsIngested: number
  groupsUpserted: number
  duplicates: number
  errorMessage?: string
}

type SupabaseLogRow = {
  id?: string
  timestamp?: string | number
  event_message?: string
  level?: string
  status_code?: number | string
  path?: string
  pathname?: string
  method?: string
  error_severity?: string
}

function supabaseAccessToken(): string | null {
  return (
    process.env.SUPABASE_ACCESS_TOKEN?.trim() ||
    process.env.SUPABASE_MANAGEMENT_API_TOKEN?.trim() ||
    null
  )
}

function supabaseProjectRef(): string | null {
  const explicit =
    process.env.SUPABASE_PROJECT_REF?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF?.trim()
  if (explicit) return explicit

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!url) return null
  try {
    const host = new URL(url).hostname
    const ref = host.split(".")[0]
    return ref || null
  } catch {
    return null
  }
}

function toIso(ts: string | number | undefined): string {
  if (typeof ts === "number") {
    // Supabase logs sometimes return microseconds
    const ms = ts > 1e14 ? Math.floor(ts / 1000) : ts
    return new Date(ms).toISOString()
  }
  if (typeof ts === "string" && ts.trim()) {
    const parsed = Date.parse(ts)
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString()
  }
  return new Date().toISOString()
}

function mapSeverity(row: SupabaseLogRow): OpsSeverity {
  const level = `${row.level ?? row.error_severity ?? ""}`.toLowerCase()
  const status = Number(row.status_code ?? 0)
  if (status >= 500 || level.includes("error") || level.includes("fatal") || level === "panic") {
    return "critical"
  }
  if (status >= 400 || level.includes("warn")) return "warning"
  return "info"
}

async function querySupabaseLogs(input: {
  token: string
  projectRef: string
  sql: string
  startIso: string
  endIso: string
}): Promise<SupabaseLogRow[]> {
  const url = new URL(
    `https://api.supabase.com/v1/projects/${input.projectRef}/analytics/endpoints/logs.all`,
  )
  url.searchParams.set("iso_timestamp_start", input.startIso)
  url.searchParams.set("iso_timestamp_end", input.endIso)
  url.searchParams.set("sql", input.sql)

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${input.token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Supabase logs API failed (${res.status}): ${text.slice(0, 300)}`)
  }

  const data = (await res.json()) as { result?: SupabaseLogRow[]; data?: SupabaseLogRow[] }
  return data.result ?? data.data ?? []
}

const LOG_QUERIES: Array<{ category: string; sql: string }> = [
  {
    category: "postgres_error",
    sql: `
      select id, cast(timestamp as datetime) as timestamp, event_message, error_severity as level
      from postgres_logs
      where error_severity in ('ERROR', 'FATAL', 'PANIC')
      order by timestamp desc
      limit 100
    `.trim(),
  },
  {
    category: "auth_error",
    sql: `
      select id, cast(timestamp as datetime) as timestamp, event_message, level
      from auth_logs
      where level = 'error' or level = 'fatal'
      order by timestamp desc
      limit 100
    `.trim(),
  },
  {
    category: "edge_error",
    sql: `
      select id, cast(timestamp as datetime) as timestamp, event_message,
        cast(metadata[0].response.status_code as int) as status_code,
        metadata[0].request.method as method,
        metadata[0].request.path as path
      from edge_logs
      where cast(metadata[0].response.status_code as int) >= 500
      order by timestamp desc
      limit 100
    `.trim(),
  },
]

export async function ingestSupabaseOpsLogs(input?: {
  sinceHours?: number
}): Promise<OpsSupabaseIngestResult> {
  const rangeHours = input?.sinceHours ?? 1
  const startedAt = new Date().toISOString()
  const supabase = createServiceRoleClient()

  const result: OpsSupabaseIngestResult = {
    status: "success",
    rangeHours,
    rowsFetched: 0,
    signalsIngested: 0,
    groupsUpserted: 0,
    duplicates: 0,
  }

  const token = supabaseAccessToken()
  const projectRef = supabaseProjectRef()

  if (!token || !projectRef) {
    result.status = "skipped"
    result.errorMessage = !token
      ? "SUPABASE_ACCESS_TOKEN is not set"
      : "SUPABASE_PROJECT_REF could not be resolved"
    await insertOpsIngestRun(supabase, {
      source: "supabase",
      status: "skipped",
      rangeHours,
      errorMessage: result.errorMessage,
      startedAt,
    })
    return result
  }

  const end = new Date()
  const start = new Date(end.getTime() - rangeHours * 60 * 60 * 1000)
  const startIso = start.toISOString()
  const endIso = end.toISOString()

  const queryErrors: string[] = []

  try {
    for (const query of LOG_QUERIES) {
      try {
        const rows = await querySupabaseLogs({
          token,
          projectRef,
          sql: query.sql,
          startIso,
          endIso,
        })
        result.rowsFetched += rows.length

        for (const row of rows) {
          const message = (row.event_message ?? "").trim() || "Supabase log event"
          const path = row.path ?? row.pathname ?? null
          const externalId =
            row.id != null
              ? `supabase:${query.category}:${row.id}`
              : `supabase:${query.category}:${toIso(row.timestamp)}:${message.slice(0, 80)}`

          const severity = mapSeverity(row)
          if (severity === "info") continue

          const recorded = await recordOpsSignal({
            source: "supabase",
            severity,
            title: `[${query.category}] ${message}`.slice(0, 240),
            message,
            category: query.category,
            path: path ? String(path).slice(0, 500) : null,
            environment: "production",
            metadata: {
              method: row.method ?? null,
              status_code: row.status_code ?? null,
              level: row.level ?? row.error_severity ?? null,
            },
            fingerprintParts: [
              "supabase",
              query.category,
              path,
              message.slice(0, 160),
              String(row.status_code ?? row.level ?? ""),
            ],
            signal: {
              externalId,
              url: path ? String(path) : null,
              occurredAt: toIso(row.timestamp),
              payload: {
                raw_level: row.level ?? row.error_severity ?? null,
                status_code: row.status_code ?? null,
                method: row.method ?? null,
              },
            },
          })

          if (recorded.duplicate) {
            result.duplicates += 1
            continue
          }
          result.signalsIngested += 1
          if (recorded.created) result.groupsUpserted += 1
        }
      } catch (queryErr) {
        const msg = queryErr instanceof Error ? queryErr.message : String(queryErr)
        queryErrors.push(`${query.category}: ${msg}`)
        console.error(`[ops] supabase query ${query.category} failed:`, msg)
      }
    }

    if (queryErrors.length === LOG_QUERIES.length) {
      result.status = "failed"
      result.errorMessage = queryErrors.join(" | ").slice(0, 500)
    } else if (queryErrors.length > 0) {
      result.status = "partial"
      result.errorMessage = queryErrors.join(" | ").slice(0, 500)
    }

    await insertOpsIngestRun(supabase, {
      source: "supabase",
      status: result.status,
      rangeHours,
      signalsIngested: result.signalsIngested,
      groupsUpserted: result.groupsUpserted,
      errorMessage: result.errorMessage ?? null,
      startedAt,
      meta: {
        project_ref: projectRef,
        rows_fetched: result.rowsFetched,
        duplicates: result.duplicates,
        query_errors: queryErrors,
      },
    })
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    result.status = "failed"
    result.errorMessage = message
    console.error("[ops] supabase ingest failed:", message)
    try {
      await insertOpsIngestRun(supabase, {
        source: "supabase",
        status: "failed",
        rangeHours,
        errorMessage: message,
        startedAt,
      })
    } catch {
      // ignore
    }
    return result
  }
}
