import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import type { ProcessKlaviyoInactivityMilestonesSummary } from "@/lib/services/klaviyoInactivityMilestones"

const REPORT_METRIC = "Inactive Sync Report"

/** Comma/space/semicolon-separated admin recipients (shared with other digests). */
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

export type InactivitySyncReportResult = {
  recipients: number
  reported: boolean
  totals: { eligible: number; emitted: number; failed: number }
}

/**
 * After an inactive-milestone sync, notify admins via Klaviyo when anything was
 * sent or anything failed, so cron health is visible without reading raw JSON.
 * Build a flow off the "Inactive Sync Report" metric. Quiet (no event) on a clean
 * no-op run. Never throws — observability must not break the cron.
 */
export async function sendInactivitySyncReport(
  summaries: ProcessKlaviyoInactivityMilestonesSummary[],
  referenceTimeIso: string,
): Promise<InactivitySyncReportResult> {
  const totals = summaries.reduce(
    (acc, s) => ({
      eligible: acc.eligible + s.eligible,
      emitted: acc.emitted + s.emitted,
      failed: acc.failed + s.failed,
    }),
    { eligible: 0, emitted: 0, failed: 0 },
  )

  const result: InactivitySyncReportResult = {
    recipients: 0,
    reported: false,
    totals,
  }

  const recipients = digestRecipients()
  result.recipients = recipients.length

  // Nothing happened and nothing broke — stay quiet, but still a successful run.
  if (recipients.length === 0 || (totals.emitted === 0 && totals.failed === 0)) {
    return result
  }

  const dayKey = referenceTimeIso.slice(0, 10)
  const properties = {
    reference_time: referenceTimeIso,
    total_eligible: totals.eligible,
    total_emitted: totals.emitted,
    total_failed: totals.failed,
    has_failures: totals.failed > 0,
    tiers: summaries.map((s) => ({
      milestone_days: s.milestoneDays,
      eligible: s.eligible,
      emitted: s.emitted,
      failed: s.failed,
      sample_errors: s.errors.slice(0, 5),
    })),
    admin_url: "/admin/tools",
  }

  for (const email of recipients) {
    try {
      await sendKlaviyoServerEvent({
        metricName: REPORT_METRIC,
        properties,
        profile: { email },
        uniqueId: `inactive-sync-report:${dayKey}:${email}`,
      })
    } catch (e) {
      console.warn("[klaviyo] inactive sync report send failed:", e)
    }
  }

  result.reported = true
  return result
}
