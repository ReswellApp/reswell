import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { addStoreStaff, removeStoreStaff } from "@/lib/services/storeStaff"
import { addStoreStaffSchema, removeStoreStaffSchema } from "@/lib/validations/consignment"

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function POST(request: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = addStoreStaffSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const result = await addStoreStaff({
    ownerProfileId: user.id,
    storeId: parsed.data.storeId,
    email: parsed.data.email,
    role: parsed.data.role,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ data: { ok: true } })
}

export async function DELETE(request: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = removeStoreStaffSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const result = await removeStoreStaff({
    ownerProfileId: user.id,
    storeId: parsed.data.storeId,
    profileId: parsed.data.profileId,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ data: { ok: true } })
}
