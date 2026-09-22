import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { downloadHaydenShopInstagramPhotoService } from "@/lib/services/haydenShopInstagramPost"
import {
  haydenShopInstagramListingIdSchema,
  haydenShopInstagramPhotoQuerySchema,
} from "@/lib/validations/hayden-shop-instagram"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id } = await context.params
  const listingId = haydenShopInstagramListingIdSchema.safeParse(id)
  const photo = haydenShopInstagramPhotoQuerySchema.safeParse({
    index: request.nextUrl.searchParams.get("index") ?? "",
  })
  if (!listingId.success || !photo.success) {
    return NextResponse.json({ error: "Invalid photo request" }, { status: 400 })
  }

  const result = await downloadHaydenShopInstagramPhotoService(listingId.data, photo.data.index)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return new NextResponse(new Uint8Array(result.bytes), {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
