import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"
import { adminSellersDirectoryDemotionBodySchema } from "@/lib/validations/sellers-directory-demotions"
import {
  addSellersDirectoryDemotionService,
  listSellersDirectoryDemotionsAdminService,
} from "@/lib/services/sellersDirectoryDemotions"

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const result = await listSellersDirectoryDemotionsAdminService(gate.ctx.supabase)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ data: { rows: result.rows } }, { status: 200 })
}

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = adminSellersDirectoryDemotionBodySchema.safeParse(json)
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const result = await addSellersDirectoryDemotionService(parsed.data.profile_id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  revalidatePath("/sellers", "page")
  return NextResponse.json({ data: { ok: true } }, { status: 201 })
}
