import { NextRequest, NextResponse } from "next/server"

import { fetchKlaviyoFlowPerformance } from "@/lib/db/klaviyoFlowStats"
import { isNotificationsCenterRange } from "@/lib/klaviyo/event-log-shared"
import { KlaviyoFlowStatsError, syncKlaviyoFlowPerformance } from "@/lib/services/klaviyoFlowStats"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin && !profile?.is_employee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const rangeParam = req.nextUrl.searchParams.get("range")
  const range = isNotificationsCenterRange(rangeParam) ? rangeParam : "7d"
  const refresh =
    req.nextUrl.searchParams.get("refresh") === "1" ||
    req.nextUrl.searchParams.get("refresh") === "true"

  try {
    if (refresh) {
      await syncKlaviyoFlowPerformance()
    }
    const data = await fetchKlaviyoFlowPerformance(supabase, range)
    return NextResponse.json(data, { status: 200 })
  } catch (e) {
    if (e instanceof KlaviyoFlowStatsError) {
      const status =
        e.missingKey ? 503 : e.status === 401 || e.status === 403 ? 502 : e.status >= 400 ? 502 : 500
      return NextResponse.json(
        {
          error: e.message,
          missingKey: e.missingKey || undefined,
          scopeHint: e.scopeHint || undefined,
        },
        { status },
      )
    }
    console.error("[admin/klaviyo/flow-stats]", e)
    return NextResponse.json({ error: "Failed to load Klaviyo flow performance" }, { status: 500 })
  }
}
