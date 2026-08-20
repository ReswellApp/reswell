import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { adminBlogPostVisibilityActionService } from "@/lib/services/blogPostsAdmin"
import { blogPostVisibilityActionSchema } from "@/lib/validations/blog"
import { revalidateBlogPaths } from "@/lib/blog/revalidate-blog"

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = blogPostVisibilityActionSchema.safeParse(json)
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const { id } = await ctx.params
  const result = await adminBlogPostVisibilityActionService(gate.ctx.supabase, id, parsed.data.action)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  revalidateBlogPaths(result.slug)
  return NextResponse.json({ data: { ok: true as const } }, { status: 200 })
}
