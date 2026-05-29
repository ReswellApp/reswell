import { NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"
import { pageSeoOverrideWriteSchema } from "@/lib/validations/page-seo"
import {
  listManagedPageSeoService,
  savePageSeoOverrideService,
} from "@/lib/services/pageSeoAdmin"
import { getManagedPage } from "@/lib/seo/managed-pages"
import { getDynamicPageType } from "@/lib/seo/dynamic-page-types"
import { PAGE_SEO_CACHE_TAG } from "@/lib/seo/page-seo-cache"

/** Route families to revalidate when a dynamic page-type template changes. */
const DYNAMIC_TYPE_REVALIDATE_PATHS: Record<string, string> = {
  "type:listing": "/l/[listing]",
  "type:brand": "/brands/[slug]",
  "type:seller": "/sellers/[slug]",
}

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const items = await listManagedPageSeoService(gate.ctx.supabase)
  return NextResponse.json({ data: { items } }, { status: 200 })
}

export async function PUT(request: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = pageSeoOverrideWriteSchema.safeParse(json)
  if (!parsed.success) {
    const err =
      parsed.error.flatten().formErrors.join(", ") ||
      Object.values(parsed.error.flatten().fieldErrors).flat().join(", ") ||
      "Invalid input"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const result = await savePageSeoOverrideService(gate.ctx.supabase, parsed.data, gate.ctx.user.id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  revalidateTag(PAGE_SEO_CACHE_TAG)
  const managed = getManagedPage(parsed.data.pageKey)
  if (managed) {
    revalidatePath(managed.defaults.path.split("?")[0])
  } else if (getDynamicPageType(parsed.data.pageKey)) {
    const path = DYNAMIC_TYPE_REVALIDATE_PATHS[parsed.data.pageKey]
    if (path) revalidatePath(path, "page")
  }

  return NextResponse.json({ data: { cleared: result.cleared } }, { status: 200 })
}
