import { NextResponse } from "next/server"

import { runEnabledWorkforceAgentsFromCron } from "@/lib/services/workforceAgents"

/**
 * Runs every workforce agent that is currently enabled in /admin/agents.
 * Protected with CRON_SECRET (same pattern as other cron routes).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await runEnabledWorkforceAgentsFromCron()
    return NextResponse.json({
      ...summary,
      ran_at: new Date().toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
