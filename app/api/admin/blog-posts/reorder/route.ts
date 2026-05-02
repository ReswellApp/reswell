import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"
import { adminReorderBlogPostsService } from "@/lib/services/blogPostsAdmin"
import { reorderBlogPostsBodySchema } from "@/lib/validations/blog"

export async function PATCH(request: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = reorderBlogPostsBodySchema.safeParse(json)
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const result = await adminReorderBlogPostsService(gate.ctx.supabase, parsed.data.orderedIds)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  revalidatePath("/blog")

  return NextResponse.json({ data: { ok: true as const } }, { status: 200 })
}
