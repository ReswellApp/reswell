import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchKlaviyoEventLogPage } from "@/lib/db/klaviyoEventLog"
import { klaviyoEventExplorerQuerySchema } from "@/lib/validations/klaviyoEventExplorer"

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

  const parsed = klaviyoEventExplorerQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const data = await fetchKlaviyoEventLogPage(supabase, parsed.data)
    return NextResponse.json({ data }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "Failed to load Klaviyo events" }, { status: 500 })
  }
}
