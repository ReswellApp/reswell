import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { listHaydenShopInstagramPostService } from "@/lib/services/haydenShopInstagramPost"

export const dynamic = "force-dynamic"

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const result = await listHaydenShopInstagramPostService()
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }
  return NextResponse.json({ data: { shop: result.shop, listings: result.listings } })
}
