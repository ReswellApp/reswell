import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"

/** Force the cached sitemap routes to rebuild on next request. */
export async function POST() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  revalidatePath("/sitemap.xml")
  revalidatePath("/sitemap-pages.xml")
  revalidatePath("/sitemap-listings.xml")

  return NextResponse.json({ data: { ok: true } }, { status: 200 })
}
