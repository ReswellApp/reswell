import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { setShopifyAccessForUser } from "@/lib/services/adminShopifyAccess"
import { adminShopifyAccessPatchSchema } from "@/lib/validations/admin-shopify-access"

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = adminShopifyAccessPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const result = await setShopifyAccessForUser(
    parsed.data.userId,
    parsed.data.grant,
  )
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    )
  }
  return NextResponse.json({ success: true })
}
