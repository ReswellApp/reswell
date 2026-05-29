import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"
import { revalidateRequestSchema, type RevalidateTarget } from "@/lib/validations/admin-tools"

/** Public paths refreshed for each target. `all` revalidates the whole root layout tree. */
const TARGET_PATHS: Record<Exclude<RevalidateTarget, "all">, string[]> = {
  home: ["/"],
  shop: ["/shop"],
  brands: ["/brands"],
  sellers: ["/sellers"],
  blog: ["/blog"],
}

/**
 * POST /api/admin/revalidate
 *
 * Admin only — force Next.js to rebuild cached public pages on next request.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

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

  const paths = TARGET_PATHS[target]
  for (const path of paths) {
    revalidatePath(path)
  }

  return NextResponse.json({ data: { target, paths } }, { status: 200 })
}
