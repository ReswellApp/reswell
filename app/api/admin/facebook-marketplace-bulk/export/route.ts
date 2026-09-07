import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { facebookMarketplaceBulkExportBodySchema } from "@/lib/validations/facebook-marketplace-bulk-export"
import { exportFacebookMarketplaceBulkWorkbookService } from "@/lib/services/facebookMarketplaceBulkExport"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = facebookMarketplaceBulkExportBodySchema.safeParse(json)
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const result = await exportFacebookMarketplaceBulkWorkbookService(
    parsed.data.seller_id,
    parsed.data.listing_ids,
  )
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "X-Listing-Count": String(result.count),
    },
  })
}
