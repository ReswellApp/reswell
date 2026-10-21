import { NextResponse } from "next/server"
import { processNotificationFanoutJobs } from "@/lib/services/notifications/fanout"
import { createServiceRoleClient } from "@/lib/supabase/server"

/**
 * Drains queued follower notifications (new listings). Publishing a listing
 * only enqueues the job so a large shop does not write one row per follower
 * inside the create request.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server config: missing service role" }, { status: 503 })
  }

  try {
    const summary = await processNotificationFanoutJobs(supabase)
    return NextResponse.json({ summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[cron] notification-fanout failed:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
