import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { scanVercelLogs, type VercelLogScanResult } from "@/lib/services/vercelLogs"

const DIGEST_METRIC = "Platform Error Digest"
const MAX_ISSUES_IN_DIGEST = 20

export type VercelErrorDigestResult = {
  sent: number
  skipped: number
  recipients: number
  criticalCount: number
  warningCount: number
  rangeHours: number
  scan: VercelLogScanResult
}

function digestRecipients(): string[] {
  const raw = process.env.ADMIN_DIGEST_EMAILS ?? ""
  return Array.from(
    new Set(
      raw
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@")),
    ),
  )
}

/**
 * Scans Vercel production logs and emails admins via Klaviyo when critical or
 * warning issues are found. Build a Klaviyo flow off the "Platform Error Digest" metric.
 */
export async function runVercelErrorDigest(
  rangeHours = 24,
): Promise<VercelErrorDigestResult> {
  const recipients = digestRecipients()
  const scan = await scanVercelLogs(rangeHours)

  const pressing = scan.issues.filter(
    (i) => i.severity === "critical" || i.severity === "warning",
  )

  const result: VercelErrorDigestResult = {
    sent: 0,
    skipped: 0,
    recipients: recipients.length,
    criticalCount: scan.criticalCount,
    warningCount: scan.warningCount,
    rangeHours,
    scan,
  }

  if (scan.skippedReason) {
    console.warn("[vercelErrorDigest] scan skipped:", scan.skippedReason)
    return result
  }

  if (pressing.length === 0 || recipients.length === 0) {
    return result
  }

  const dayKey = new Date().toISOString().slice(0, 10)
  const properties = {
    range_hours: rangeHours,
    scanned_at: scan.scannedAt,
    deployments_scanned: scan.deploymentsScanned,
    raw_log_count: scan.rawLogCount,
    critical_count: scan.criticalCount,
    warning_count: scan.warningCount,
    issues: pressing.slice(0, MAX_ISSUES_IN_DIGEST).map((i) => ({
      severity: i.severity,
      category: i.category,
      path: i.path,
      method: i.method,
      status_code: i.statusCode,
      level: i.level,
      message: i.message,
      occurrences: i.occurrences,
      source: i.source,
      timestamp_ms: i.timestampMs,
      deployment_id: i.deploymentId,
    })),
    vercel_logs_url: "https://vercel.com/dashboard",
  }

  for (const email of recipients) {
    const res = await sendKlaviyoServerEvent({
      metricName: DIGEST_METRIC,
      properties,
      profile: { email },
      uniqueId: `vercel-error-digest:${dayKey}:${email}`,
    })
    if (res.ok) result.sent += 1
    else result.skipped += 1
  }

  return result
}
