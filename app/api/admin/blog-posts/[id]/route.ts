import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  adminDeleteBlogPostService,
  adminGetBlogArticleService,
  adminUpdateBlogPostService,
} from "@/lib/services/blogPostsAdmin"
import { adminBlogPostWriteSchema } from "@/lib/validations/blog"

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  const article = await adminGetBlogArticleService(gate.ctx.supabase, id)
  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ data: { article } }, { status: 200 })
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const { id } = await ctx.params
  const result = await adminUpdateBlogPostService(gate.ctx.supabase, id, parsed.data)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.slugTaken ? 409 : 500 },
    )
  }

  revalidatePath("/blog")
  revalidatePath("/blog/[slug]", "layout")
  revalidatePath(`/blog/${parsed.data.slug}`)
  return NextResponse.json({ data: { ok: true as const } }, { status: 200 })
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  const result = await adminDeleteBlogPostService(gate.ctx.supabase, id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }

  revalidatePath("/blog")
  revalidatePath("/blog/[slug]", "layout")
  return NextResponse.json({ data: { ok: true as const } }, { status: 200 })
}
