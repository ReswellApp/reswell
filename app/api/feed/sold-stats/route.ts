import { NextResponse } from "next/server"
import { getSoldFeedStats } from "@/lib/feed-sold-stats"
import { formatGmv } from "@/lib/format-gmv"

export const revalidate = 600

export async function GET() {
  try {
    const { soldCount, gmvTotal } = await getSoldFeedStats()
    return NextResponse.json({
      soldCount,
      gmvTotal,
      gmvFormatted: formatGmv(gmvTotal),
    })
  } catch (e) {
    console.error("[api/feed/sold-stats]", e)
    return NextResponse.json({ soldCount: 0, gmvTotal: 0, gmvFormatted: "$0" }, { status: 200 })
  }
}
