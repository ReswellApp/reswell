import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { ensureBlogImagesBucket } from "@/lib/services/blogImagesBucketBootstrap"

/** Creates Storage bucket `blog-images` when migrations have not run yet (requires service role locally / in prod). */
export async function POST() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const result = await ensureBlogImagesBucket()
  if (!result.ok) {
    const status =
      result.skippedReason === "missing_service_role" ? 503 : 500
    return NextResponse.json(
      {
        error: result.error,
        ...(result.skippedReason ? { skippedReason: result.skippedReason } : {}),
      },
      { status },
    )
  }

  return NextResponse.json({ data: { created: result.created } }, { status: 200 })
}
