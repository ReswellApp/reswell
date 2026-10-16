import { NextResponse } from "next/server"
import { runBoardFinderNewListingAlerts } from "@/lib/services/boardFinderNewListingAlerts"

export const maxDuration = 300

/**
 * Board Finder catch-up, about every 15 minutes. Replays saved surfboard
 * searches against boards first published since the last run (capped so a
 * stuck watermark cannot email old inventory), and retries listings the
 * search index was not ready for. Alerts only when that publish is newer
 * than the search. The first run records the watermark and does not email
 * about boards already listed.
 * Protected with CRON_SECRET.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await runBoardFinderNewListingAlerts()
    return NextResponse.json({ ok: true, summary, reference_time: new Date().toISOString() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[cron] board-finder-new-listings failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
