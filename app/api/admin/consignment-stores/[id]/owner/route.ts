import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { transferConsignmentStoreOwner } from "@/lib/services/adminConsignmentStoreTransfer"
import { transferConsignmentStoreOwnerSchema } from "@/lib/validations/consignment-store"

async function requireIsAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single()

  if (!profile?.is_admin) return null
  return user
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const admin = await requireIsAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: storeId } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = transferConsignmentStoreOwnerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const result = await transferConsignmentStoreOwner({
    storeId,
    newOwnerProfileId: parsed.data.newOwnerProfileId,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  return NextResponse.json({ data: { ok: true } }, { status: 200 })
}
