import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  fetchNotificationsCenterAnalytics,
  isNotificationsCenterRange,
} from "@/lib/db/klaviyoEventLog"
import { isKlaviyoMetricCategoryFilter } from "@/lib/klaviyo/event-log-shared"

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
  const categoryParam = req.nextUrl.searchParams.get("category")
  const category = isKlaviyoMetricCategoryFilter(categoryParam) ? categoryParam : "all"

  try {
    const data = await fetchNotificationsCenterAnalytics(supabase, range, category)
    return NextResponse.json(data, { status: 200 })
  } catch {
    return NextResponse.json({ error: "Failed to load notifications analytics" }, { status: 500 })
  }
}
