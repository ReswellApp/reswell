import { NextResponse } from "next/server"
import { runBoardFinderNewListingAlerts } from "@/lib/services/boardFinderNewListingAlerts"

export const maxDuration = 300

/**
 * Daily Board Finder catch-up. Replays saved surfboard searches against the
 * listing index for boards first published since the last run, and only when
 * that publish is newer than the search. The first run records the watermark
 * and does not email about boards already listed.
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
