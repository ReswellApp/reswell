import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"
import { removeSellersDirectoryDemotionService } from "@/lib/services/sellersDirectoryDemotions"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function DELETE(_request: Request, ctx: { params: Promise<{ profileId: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { profileId: raw } = await ctx.params
  const profileId = typeof raw === "string" ? decodeURIComponent(raw.trim()) : ""
  if (!profileId || !UUID_RE.test(profileId)) {
    return NextResponse.json({ error: "Invalid profile id" }, { status: 400 })
  }

  const result = await removeSellersDirectoryDemotionService(profileId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  revalidatePath("/sellers", "page")
  return NextResponse.json({ data: { deleted: true } }, { status: 200 })
}
