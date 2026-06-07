import "@/lib/klaviyo/bootstrap-env"
import { bootstrapPlatformErrorDigestMetric } from "@/lib/klaviyo/bootstrap-platform-error-digest-metric"
import { NextResponse } from "next/server"

/**
 * One-time call so **Platform Error Digest** appears under Flows → Your metrics → API.
 * Klaviyo only surfaces custom API metrics after at least one accepted Events API event.
 *
 * `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { result } = await bootstrapPlatformErrorDigestMetric()

    return NextResponse.json({
      ok: result.ok,
      message:
        'Seed event sent. Open Klaviyo → Flows → Create flow → Metric — "Platform Error Digest" should appear under API within a few minutes. Seed uses profile external_id reswell-metric-seed-platform-errors and property reswell_metric_seed — add a flow filter to ignore seed events.',
      result,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
