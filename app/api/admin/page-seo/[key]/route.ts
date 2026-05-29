import { NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"
import { resetPageSeoOverrideService } from "@/lib/services/pageSeoAdmin"
import { getManagedPage } from "@/lib/seo/managed-pages"
import { PAGE_SEO_CACHE_TAG } from "@/lib/seo/page-seo-cache"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { key } = await params
  const managed = getManagedPage(key)
  if (!managed) {
    return NextResponse.json({ error: "Unknown page" }, { status: 404 })
  }

  const result = await resetPageSeoOverrideService(gate.ctx.supabase, key)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  revalidateTag(PAGE_SEO_CACHE_TAG)
  revalidatePath(managed.defaults.path.split("?")[0])

  return NextResponse.json({ data: { ok: true } }, { status: 200 })
}
