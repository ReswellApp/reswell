import { NextRequest, NextResponse } from "next/server"
import { requireShopifyMerchant } from "@/lib/shopify/authorize"
import { getMerchantShopifyCatalog } from "@/lib/services/shopifyCatalogManager"
import { shopifyLinkedListingsQuerySchema } from "@/lib/validations/shopify"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireShopifyMerchant()
  if (!auth.ok) return auth.response
  const params = request.nextUrl.searchParams
  const parsed = shopifyLinkedListingsQuerySchema.safeParse({
    filter: params.get("filter") ?? undefined,
    section: params.get("section") || null,
    query: params.get("query") ?? undefined,
    page: params.get("page") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid listing filters" }, { status: 400 })
  }
  const result = await getMerchantShopifyCatalog({
    userId: auth.accountId,
    ...parsed.data,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ data: result.data })
}
