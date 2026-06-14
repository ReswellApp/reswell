import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"
import { revalidateSellersDirectoryCatalog } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { createClient } from "@/lib/supabase/server"
import { revalidateRequestSchema, type RevalidateTarget } from "@/lib/validations/admin-tools"

/** Public paths refreshed for each target. `all` revalidates the whole root layout tree. */
const TARGET_PATHS: Record<Exclude<RevalidateTarget, "all">, string[]> = {
  home: ["/"],
  brands: ["/brands"],
  sellers: ["/sellers"],
  blog: ["/blog"],
}

async function authorizeRevalidate(request: NextRequest): Promise<boolean> {
  const secret = process.env.SEARCH_REINDEX_SECRET?.trim()
  const auth = request.headers.get("authorization") || ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
  if (secret && token === secret) return true

  const gate = await requireAdmin()
  return gate.ok
}

/**
 * POST /api/admin/revalidate
 *
 * Auth: admin session, or `Authorization: Bearer <SEARCH_REINDEX_SECRET>` for scripts/CI.
 */
export async function POST(request: NextRequest) {
  const authorized = await authorizeRevalidate(request)
  if (!authorized) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return NextResponse.json(
      { error: user ? "Forbidden" : "Sign in required" },
      { status: user ? 403 : 401 },
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = revalidateRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid target" }, { status: 400 })
  }

  const { target } = parsed.data

  if (target === "all") {
    revalidatePath("/", "layout")
    return NextResponse.json({ data: { target, paths: ["/ (layout)"] } }, { status: 200 })
  }

  if (target === "sellers") {
    revalidateSellersDirectoryCatalog()
    return NextResponse.json(
      { data: { target, paths: ["/sellers (layout)", "sellers-directory cache tag"] } },
      { status: 200 },
    )
  }

  const paths = TARGET_PATHS[target]
  for (const path of paths) {
    revalidatePath(path)
  }

  return NextResponse.json({ data: { target, paths } }, { status: 200 })
}
