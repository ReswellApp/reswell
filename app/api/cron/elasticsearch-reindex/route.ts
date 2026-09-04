import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import {
  ELASTICSEARCH_CATCH_UP_LOOKBACK_MS,
  reindexElasticsearchFromSupabase,
} from "@/lib/services/elasticsearchReindex"

export const maxDuration = 300

/**
 * Twice-daily catch-up reindex of listings, sellers, and forum threads that
 * changed in the last 14 hours. Full catalog rebuilds stay on admin `/api/search/reindex`.
 *
 * GET /api/cron/elasticsearch-reindex
 * Protected with CRON_SECRET when set. Scheduled in vercel.json (`15 * * * *`).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isElasticsearchConfigured()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "elasticsearch_not_configured",
      reference_time: new Date().toISOString(),
    })
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server config: missing service role" }, { status: 503 })
  }

  try {
    const catchUpSince = new Date(Date.now() - ELASTICSEARCH_CATCH_UP_LOOKBACK_MS)
    const result = await reindexElasticsearchFromSupabase(supabase, { catchUpSince })
    if (!result.ok) {
      console.error("[cron] elasticsearch-reindex failed:", result.error)
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      ok: true,
      mode: "catch_up",
      catch_up_since: catchUpSince.toISOString(),
      summary: result.summary,
      reference_time: new Date().toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[cron] elasticsearch-reindex failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
