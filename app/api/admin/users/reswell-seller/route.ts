import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  listReswellSellerProfileIds,
  setReswellSellerForUser,
} from "@/lib/services/adminReswellSeller"
import { adminReswellSellerPatchSchema } from "@/lib/validations/admin-reswell-seller"

async function requireIsAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single()

  if (!profile?.is_admin) return null
  return user
}

export async function GET() {
  const supabase = await createClient()
  const admin = await requireIsAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const result = await listReswellSellerProfileIds()
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 })
  }

  return NextResponse.json({ data: { profileIds: result.profileIds } }, { status: 200 })
}

export async function PATCH(request: NextRequest) {
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

  const parsed = adminReswellSellerPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const result = await setReswellSellerForUser(parsed.data.userId, parsed.data.grant)
  if (!result.ok) {
    const status = result.message === "User not found" ? 404 : 500
    return NextResponse.json({ error: result.message }, { status })
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
