import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { facebookMarketplaceBulkPhotosQuerySchema } from "@/lib/validations/facebook-marketplace-bulk-export"
import { exportFacebookMarketplaceListingPhotosZipService } from "@/lib/services/facebookMarketplaceBulkExport"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const parsed = facebookMarketplaceBulkPhotosQuerySchema.safeParse({
    seller_id: request.nextUrl.searchParams.get("seller_id") ?? "",
  })
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid seller"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const result = await exportFacebookMarketplaceListingPhotosZipService(parsed.data.seller_id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return new NextResponse(result.stream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
      "X-Listing-Count": String(result.listingCount),
      "X-Photo-Count": String(result.imageCount),
    },
  })
}
