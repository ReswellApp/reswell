import { NextResponse } from "next/server"

import { trimRecentListingViewsRetention } from "@/lib/services/recentListingViewsRetention"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { isCronRequestAuthorized } from "@/lib/utils/cron-auth"

export const maxDuration = 60

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret?.trim()) {
    return NextResponse.json({ error: "Cron authentication is not configured" }, { status: 503 })
  }
  if (!isCronRequestAuthorized(request, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await trimRecentListingViewsRetention(createServiceRoleClient())
    return NextResponse.json({
      summary,
      completedAt: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[cron/trim-recent-listing-views]", message)
    return NextResponse.json({ error: "Recently viewed retention failed" }, { status: 500 })
  }
}
