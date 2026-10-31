import { NextResponse } from "next/server"
import { runSurfboardDimensionPhotoQueueCron } from "@/lib/services/surfboardDimensionPhotoCron"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { isCronRequestAuthorized } from "@/lib/utils/cron-auth"

export const maxDuration = 300

/**
 * Every 4 hours: rematch Bad/Close dimension-photo rows, then scan up to 15
 * unscanned active/sold surfboards so /admin/dimension-photo-match Unrated is
 * pre-filled. Skips new scans when Unrated is already ≥ 25.
 * Protected with CRON_SECRET.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!isCronRequestAuthorized(request, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return NextResponse.json(
      { error: "Server config: missing service role" },
      { status: 503 },
    )
  }

  try {
    const result = await runSurfboardDimensionPhotoQueueCron(service, {
      scanLimit: 15,
      rematchLimit: 8,
      unratedCap: 25,
    })

    if (!result.enabled) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "surfboard_dimension_photo disabled or not configured",
        reference_time: new Date().toISOString(),
      })
    }

    const hardError = result.rematch.error || result.scan.error
    if (hardError && result.rematch.created === 0 && result.scan.scanned === 0) {
      console.error("[cron] surfboard-dimension-photo-queue:", hardError)
      return NextResponse.json({ error: hardError, result }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      result,
      reference_time: new Date().toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[cron] surfboard-dimension-photo-queue failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
