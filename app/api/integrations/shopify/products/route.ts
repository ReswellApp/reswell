import { NextRequest, NextResponse } from "next/server"
import { requireShopifyMerchant } from "@/lib/shopify/authorize"
import {
  listMerchantShopifyProducts,
  selectMerchantShopifyProduct,
  unpublishMerchantShopifyProduct,
} from "@/lib/services/shopifyConnection"
import {
  shopifyProductSelectionSchema,
  shopifyProductsQuerySchema,
  shopifyProductUnpublishSchema,
} from "@/lib/validations/shopify"

export async function GET(request: NextRequest) {
  const auth = await requireShopifyMerchant()
  if (!auth.ok) return auth.response
  const parsed = shopifyProductsQuerySchema.safeParse({
    query: request.nextUrl.searchParams.get("query") ?? undefined,
    after: request.nextUrl.searchParams.get("after") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product search" }, { status: 400 })
  }
  const result = await listMerchantShopifyProducts({
    userId: auth.user.id,
    ...parsed.data,
  })
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    )
  }
  return NextResponse.json({ data: result.data })
}

export async function POST(request: NextRequest) {
  const auth = await requireShopifyMerchant()
  if (!auth.ok) return auth.response
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = shopifyProductSelectionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Choose a Shopify product and Reswell category" },
      { status: 400 },
    )
  }
  const result = await selectMerchantShopifyProduct({
    userId: auth.user.id,
    ...parsed.data,
  })
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    )
  }
  return NextResponse.json({ data: result.data })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireShopifyMerchant()
  if (!auth.ok) return auth.response
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = shopifyProductUnpublishSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Shopify product" }, { status: 400 })
  }
  const result = await unpublishMerchantShopifyProduct({
    userId: auth.user.id,
    productId: parsed.data.productId,
  })
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    )
  }
  return NextResponse.json({ data: result.data })
}
