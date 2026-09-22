import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { downloadHaydenShopInstagramPhotosZipService } from "@/lib/services/haydenShopInstagramPost"
import { haydenShopInstagramListingIdSchema } from "@/lib/validations/hayden-shop-instagram"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id } = await context.params
  const parsed = haydenShopInstagramListingIdSchema.safeParse(id)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid listing" }, { status: 400 })
  }

  const result = await downloadHaydenShopInstagramPhotosZipService(parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return new NextResponse(result.stream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
      "X-Photo-Count": String(result.imageCount),
    },
  })
}
