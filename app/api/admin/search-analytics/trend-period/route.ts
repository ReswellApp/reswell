import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSearchTrendPeriodDetailService } from "@/lib/services/searchAnalytics"
import { searchTrendPeriodQuerySchema } from "@/lib/validations/search-analytics"

export async function GET(request: NextRequest) {
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

  const raw = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = searchTrendPeriodQuerySchema.safeParse({
    mode: raw.mode === "month" ? "month" : "all",
    yearMonth:
      typeof raw.yearMonth === "string" && raw.yearMonth.trim() !== ""
        ? raw.yearMonth.trim()
        : undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  const data = await getSearchTrendPeriodDetailService(
    parsed.data.mode,
    parsed.data.yearMonth,
  )

  return NextResponse.json({ data }, { status: 200 })
}
