import { NextResponse } from "next/server"
import { ingestVercelOpsLogs } from "@/lib/services/opsVercelIngest"
import { ingestSupabaseOpsLogs } from "@/lib/services/opsSupabaseIngest"

/**
 * Hourly pull of Vercel request-log issues + Supabase project logs into ops_* tables.
 * Protected with CRON_SECRET (same pattern as other cron routes).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const vercelHours = Number(url.searchParams.get("vercelHours") ?? "2")
  const supabaseHours = Number(url.searchParams.get("supabaseHours") ?? "1")

  const safeVercel =
    Number.isFinite(vercelHours) && vercelHours > 0 && vercelHours <= 48
      ? vercelHours
      : 2
  const safeSupabase =
    Number.isFinite(supabaseHours) && supabaseHours > 0 && supabaseHours <= 24
      ? supabaseHours
      : 1

  try {
    const [vercel, supabase] = await Promise.all([
      ingestVercelOpsLogs({ sinceHours: safeVercel, environment: "production" }),
      ingestSupabaseOpsLogs({ sinceHours: safeSupabase }),
    ])

    return NextResponse.json({
      vercel,
      supabase,
      reference_time: new Date().toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[cron] ops-ingest failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
