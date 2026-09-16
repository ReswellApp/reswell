import { NextResponse } from "next/server"

import { createServiceRoleClient } from "@/lib/supabase/server"
import { reviewPendingFraudMessagesBatch } from "@/lib/services/reviewFraudMessagesBatch"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Confirms or dismisses pending fraud_messages rows with Gemini.
 * Protected with CRON_SECRET.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = createServiceRoleClient()
    const summary = await reviewPendingFraudMessagesBatch(supabase)
    return NextResponse.json({ summary, reference_time: new Date().toISOString() })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[cron] review-fraud-messages failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
