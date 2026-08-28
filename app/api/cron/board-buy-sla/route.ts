import { applyOverdueBoardBuyAutoQuotes } from "@/lib/services/boardBuySla"
import { NextResponse } from "next/server"

/**
 * Every 5 minutes: if ops has not quoted a buy-program submission within 30 minutes,
 * auto-offer 20% off the seller's asking price.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await applyOverdueBoardBuyAutoQuotes()
    return NextResponse.json({
      summary,
      reference_time: new Date().toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[cron] board-buy-sla failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
