import "@/lib/klaviyo/bootstrap-env"
import { bootstrapFavoritesMetrics } from "@/lib/klaviyo/bootstrap-favorites-metrics"
import { NextResponse } from "next/server"

/**
 * One-time (or rare) call so **Listing Saved**, **Favorites Digest**, and **Favorite Price Drop**
 * appear under Flows → Your metrics → API.
 *
 * `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { results } = await bootstrapFavoritesMetrics()
    const accepted = results.every((r) => r.ok)

    return NextResponse.json({
      ok: accepted,
      message:
        "Seed events sent. Open Klaviyo → Flows → Create flow → Metric — the three favorites metrics should appear under API within a few minutes. Seed profile external_id is reswell-metric-seed-favorites; filter on reswell_metric_seed if needed.",
      results,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
