import { createServiceRoleClient } from "@/lib/supabase/server"
import { insertOpsIngestRun } from "@/lib/db/ops"
import { recordOpsSignal } from "@/lib/services/opsIngest"
import {
  analyzeVercelRequestLogs,
  fetchRecentVercelRequestLogs,
  type PlatformLogIssue,
} from "@/lib/services/vercelRequestLogMonitor"
import type { OpsSeverity } from "@/lib/types/ops"

export type OpsVercelIngestResult = {
  status: "success" | "partial" | "failed" | "skipped"
  rangeHours: number
  logsFetched: number
  issuesFound: number
  signalsIngested: number
  groupsUpserted: number
  duplicates: number
  errorMessage?: string
}

function mapSeverity(severity: PlatformLogIssue["severity"]): OpsSeverity {
  return severity === "critical" ? "critical" : "warning"
}

export async function ingestVercelOpsLogs(input?: {
  sinceHours?: number
  environment?: "production" | "preview"
}): Promise<OpsVercelIngestResult> {
  const rangeHours = input?.sinceHours ?? 2
  const environment = input?.environment ?? "production"
  const startedAt = new Date().toISOString()
  const supabase = createServiceRoleClient()

  const result: OpsVercelIngestResult = {
    status: "success",
    rangeHours,
    logsFetched: 0,
    issuesFound: 0,
    signalsIngested: 0,
    groupsUpserted: 0,
    duplicates: 0,
  }

  try {
    if (!process.env.VERCEL_ACCESS_TOKEN?.trim() && !process.env.VERCEL_TOKEN?.trim()) {
      result.status = "skipped"
      result.errorMessage = "VERCEL_ACCESS_TOKEN is not set"
      await insertOpsIngestRun(supabase, {
        source: "vercel",
        status: "skipped",
        rangeHours,
        errorMessage: result.errorMessage,
        startedAt,
        meta: { environment },
      })
      return result
    }

    const logs = await fetchRecentVercelRequestLogs({
      sinceHours: rangeHours,
      environment,
    })
    result.logsFetched = logs.length

    const issues = analyzeVercelRequestLogs(logs)
    result.issuesFound = issues.length

    for (const issue of issues) {
      // Stable per issue-shape + scan hour so hourly cron updates the group without
      // inventing a new signal for every distinct request id.
      const hourBucket = issue.lastSeenAt.slice(0, 13)
      const externalId = [
        "vercel",
        issue.category,
        issue.requestMethod,
        issue.requestPath,
        String(issue.responseStatusCode),
        issue.message.slice(0, 80),
        hourBucket,
      ].join(":")

      const recorded = await recordOpsSignal({
        source: "vercel",
        severity: mapSeverity(issue.severity),
        title: `${issue.requestMethod} ${issue.requestPath} → ${issue.responseStatusCode || issue.level}`,
        message: issue.message,
        category: issue.category,
        path: issue.requestPath,
        environment: issue.environment,
        metadata: {
          vercel_source: issue.source,
          level: issue.level,
          sample_request_ids: issue.sampleRequestIds,
        },
        fingerprintParts: [
          "vercel",
          issue.category,
          issue.requestMethod,
          issue.requestPath,
          String(issue.responseStatusCode),
          issue.message.slice(0, 120),
        ],
        // One signal per issue-shape per hour. Count uses the scan's grouped occurrence total
        // the first time we see that hour-bucket; later pulls in the same hour are no-ops.
        occurrenceDelta: Math.max(1, issue.occurrenceCount),
        signal: {
          externalId,
          url: issue.requestPath,
          occurredAt: issue.lastSeenAt,
          payload: {
            first_seen_at: issue.firstSeenAt,
            last_seen_at: issue.lastSeenAt,
            occurrence_count: issue.occurrenceCount,
            sample_request_ids: issue.sampleRequestIds,
            method: issue.requestMethod,
            status_code: issue.responseStatusCode,
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

    await insertOpsIngestRun(supabase, {
      source: "vercel",
      status: "success",
      rangeHours,
      signalsIngested: result.signalsIngested,
      groupsUpserted: result.groupsUpserted,
      startedAt,
      meta: {
        environment,
        logs_fetched: result.logsFetched,
        issues_found: result.issuesFound,
        duplicates: result.duplicates,
      },
    })
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    result.status = "failed"
    result.errorMessage = message
    console.error("[ops] vercel ingest failed:", message)
    try {
      await insertOpsIngestRun(supabase, {
        source: "vercel",
        status: "failed",
        rangeHours,
        errorMessage: message,
        startedAt,
        meta: { environment },
      })
    } catch {
      // ignore secondary failure
    }
    return result
  }
}
