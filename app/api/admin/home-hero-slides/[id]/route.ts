import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"
import { deleteHomeHeroSlideService } from "@/lib/services/homeHeroSlides"

/** UUID, numeric id, or similar — avoid rejecting valid `images` primary keys */
const SLIDE_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id: raw } = await ctx.params
  const id = typeof raw === "string" ? decodeURIComponent(raw.trim()) : ""
  if (!id || !SLIDE_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid slide id" }, { status: 400 })
  }

  const result = await deleteHomeHeroSlideService(id)
  if (!result.ok) {
    const isNotFound =
      /no row deleted|not found/i.test(result.error) || result.error.includes("No row deleted")
    const status = isNotFound ? 404 : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  revalidatePath("/", "layout")
  revalidatePath("/", "page")
  return NextResponse.json({ data: { deleted: true } }, { status: 200 })
}
