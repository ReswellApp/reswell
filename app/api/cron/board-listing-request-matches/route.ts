import { NextResponse } from "next/server"
import { runBoardListingRequestMatchesCron } from "@/lib/services/notifyBoardListingRequestMatches"

export const maxDuration = 60

/**
 * Daily: scans new surfboard listings against open `board_listing_requests` rows and fires
 * Klaviyo metric **Board Listing Match** when brand/model/title criteria align.
 * Protected with CRON_SECRET (same pattern as other cron routes).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await runBoardListingRequestMatchesCron(24)
    return NextResponse.json({ ok: true, summary, reference_time: new Date().toISOString() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[cron] board-listing-request-matches failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
