import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getSearchInsightActionsSnapshot,
  saveSearchInsightAction,
} from "@/lib/services/searchInsightActions"
import { upsertSearchInsightActionSchema } from "@/lib/validations/search-insight-actions"

async function requireStaff() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, forbidden: false }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin && !profile?.is_employee) {
    return { supabase, user, forbidden: true }
  }
  return { supabase, user, forbidden: false }
}

export async function GET() {
  const { supabase, user, forbidden } = await requireStaff()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const data = await getSearchInsightActionsSnapshot(supabase)
    return NextResponse.json({ data }, { status: 200 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("GET insight-actions:", msg)
    return NextResponse.json({ error: "Could not load actions" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { supabase, user, forbidden } = await requireStaff()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const raw = await request.json().catch(() => null)
  const parsed = upsertSearchInsightActionSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { action, error } = await saveSearchInsightAction(supabase, parsed.data, user.id)
  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({ data: { action } }, { status: 200 })
}
