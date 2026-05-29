import { NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"
import { resetPageSeoOverrideService } from "@/lib/services/pageSeoAdmin"
import { getManagedPage } from "@/lib/seo/managed-pages"
import { getDynamicPageType } from "@/lib/seo/dynamic-page-types"
import { PAGE_SEO_CACHE_TAG } from "@/lib/seo/page-seo-cache"

const DYNAMIC_TYPE_REVALIDATE_PATHS: Record<string, string> = {
  "type:listing": "/l/[listing]",
  "type:brand": "/brands/[slug]",
  "type:seller": "/sellers/[slug]",
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { key } = await params
  const managed = getManagedPage(key)
  const dynamic = managed ? null : getDynamicPageType(key)
  if (!managed && !dynamic) {
    return NextResponse.json({ error: "Unknown page" }, { status: 404 })
  }

  const result = await resetPageSeoOverrideService(gate.ctx.supabase, key, gate.ctx.user.id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  revalidateTag(PAGE_SEO_CACHE_TAG)
  if (managed) {
    revalidatePath(managed.defaults.path.split("?")[0])
  } else {
    const path = DYNAMIC_TYPE_REVALIDATE_PATHS[key]
    if (path) revalidatePath(path, "page")
  }

  return NextResponse.json({ data: { ok: true } }, { status: 200 })
}
