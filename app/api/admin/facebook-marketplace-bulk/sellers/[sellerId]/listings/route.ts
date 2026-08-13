import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { facebookMarketplaceBulkSellerIdSchema } from "@/lib/validations/facebook-marketplace-bulk-export"
import { listFacebookMarketplaceBulkSellerListingsService } from "@/lib/services/facebookMarketplaceBulkExport"

export async function GET(
  _request: Request,
  context: { params: Promise<{ sellerId: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { sellerId } = await context.params
  const parsed = facebookMarketplaceBulkSellerIdSchema.safeParse(sellerId)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid seller id" }, { status: 400 })
  }

  const result = await listFacebookMarketplaceBulkSellerListingsService(parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json(
    {
      data: {
        seller: result.seller,
        listings: result.listings,
        skipped: result.skipped,
      },
    },
    { status: 200 },
  )
}
