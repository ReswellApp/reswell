import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createConsignmentStore } from "@/lib/services/adminConsignmentStore"
import { createConsignmentStoreSchema } from "@/lib/validations/consignment-store"

async function requireIsAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single()

  if (!profile?.is_admin) return null
  return user
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const admin = await requireIsAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = createConsignmentStoreSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const result = await createConsignmentStore(parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  return NextResponse.json({ data: { store: result.store } }, { status: 201 })
}
