import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"
import { adminBlogPostWriteSchema } from "@/lib/validations/blog"
import { adminCreateBlogPostService, adminListBlogArticlesService } from "@/lib/services/blogPostsAdmin"

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const rows = await adminListBlogArticlesService(gate.ctx.supabase)
  return NextResponse.json({ data: { articles: rows } }, { status: 200 })
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

  const parsed = adminBlogPostWriteSchema.safeParse(json)
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const result = await adminCreateBlogPostService(gate.ctx.supabase, parsed.data)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.slugTaken ? 409 : 500 },
    )
  }

  revalidatePath("/blog")
  revalidatePath("/blog/[slug]", "layout")
  return NextResponse.json({ data: { id: result.id } }, { status: 201 })
}
