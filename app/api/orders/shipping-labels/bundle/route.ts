import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { buildSellerPrintableShippingLabelsPdf } from "@/lib/services/sellerPrintShippingLabels"
import { sellerPrintShippingLabelsQuerySchema } from "@/lib/validations/seller-print-shipping-labels"

/**
 * GET /api/orders/shipping-labels/bundle?ids=uuid,uuid
 *
 * Seller-only merged PDF of open shipment labels the seller selected to print.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = sellerPrintShippingLabelsQuerySchema.safeParse({
    ids: request.nextUrl.searchParams.get("ids") ?? "",
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid shipping labels" }, { status: 400 })
  }

  const serviceSupabase = createServiceRoleClient()
  const result = await buildSellerPrintableShippingLabelsPdf({
    supabase,
    serviceSupabase,
    sellerId: user.id,
    orderIds: parsed.data.ids,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const inline = request.nextUrl.searchParams.get("inline") === "1"
  const fileName = parsed.data.ids.length === 1 ? "shipping-label.pdf" : "shipping-labels.pdf"
  const safe = fileName.replace(/["\r\n\\]/g, "_")
  const mode = inline ? "inline" : "attachment"

  return new NextResponse(Buffer.from(result.bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${mode}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`,
      "Cache-Control": "private, no-store",
    },
  })
}
