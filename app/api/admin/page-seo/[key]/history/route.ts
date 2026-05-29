import { NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"
import { pageSeoOverrideWriteSchema } from "@/lib/validations/page-seo"
import {
  listPageSeoHistoryService,
  savePageSeoOverrideService,
} from "@/lib/services/pageSeoAdmin"
import { getManagedPage } from "@/lib/seo/managed-pages"
import { getDynamicPageType } from "@/lib/seo/dynamic-page-types"
import { PAGE_SEO_CACHE_TAG } from "@/lib/seo/page-seo-cache"

const DYNAMIC_TYPE_REVALIDATE_PATHS: Record<string, string> = {
  "type:listing": "/l/[listing]",
  "type:brand": "/brands/[slug]",
  "type:seller": "/sellers/[slug]",
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { key } = await params
  const history = await listPageSeoHistoryService(gate.ctx.supabase, key)
  return NextResponse.json({ data: { history } }, { status: 200 })
}

/** Restore a historical snapshot for this page. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { key } = await params
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const snapshot = (json as { snapshot?: unknown })?.snapshot ?? {}
  const parsed = pageSeoOverrideWriteSchema.safeParse({ pageKey: key, ...(snapshot as object) })
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid snapshot" }, { status: 400 })
  }

  const result = await savePageSeoOverrideService(gate.ctx.supabase, parsed.data, gate.ctx.user.id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  revalidateTag(PAGE_SEO_CACHE_TAG)
  const managed = getManagedPage(key)
  if (managed) {
    revalidatePath(managed.defaults.path.split("?")[0])
  } else if (getDynamicPageType(key)) {
    const path = DYNAMIC_TYPE_REVALIDATE_PATHS[key]
    if (path) revalidatePath(path, "page")
  }

  return NextResponse.json({ data: { cleared: result.cleared } }, { status: 200 })
}
