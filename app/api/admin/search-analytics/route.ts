import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getSearchAnalyticsDashboardService } from "@/lib/services/searchAnalytics"

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional().default(14),
})

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
  const parsed = querySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  const data = await getSearchAnalyticsDashboardService(parsed.data.days)
  return NextResponse.json({ data }, { status: 200 })
}
