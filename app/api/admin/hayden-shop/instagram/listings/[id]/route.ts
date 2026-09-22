import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { getHaydenShopInstagramPostService } from "@/lib/services/haydenShopInstagramPost"
import { haydenShopInstagramListingIdSchema } from "@/lib/validations/hayden-shop-instagram"

export const dynamic = "force-dynamic"

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

  const result = await getHaydenShopInstagramPostService(parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }
  return NextResponse.json({ data: { listing: result.listing } })
}
