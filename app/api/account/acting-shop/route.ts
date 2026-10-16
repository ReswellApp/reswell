import { NextResponse } from "next/server"
import { getShopAccountContext } from "@/lib/services/accountAccess"

/** Sell flows ask which shop the signed-in user is operating. The cookie is not the authority. */
export async function GET() {
  const shop = await getShopAccountContext()
  if (!shop || !shop.actingAsShop || !shop.permissions.has("listings.write")) {
    return NextResponse.json({ accountId: null })
  }
  return NextResponse.json({ accountId: shop.accountId })
}
