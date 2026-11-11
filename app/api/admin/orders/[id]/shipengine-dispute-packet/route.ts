import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { getAdminShipEngineDisputePacketsForOrder } from "@/lib/services/shipEngineDisputePacket"

export const dynamic = "force-dynamic"

const orderIdSchema = z.string().uuid()

/**
 * GET /api/admin/orders/:id/shipengine-dispute-packet
 *
 * Prefills copyable Stamps / ShipEngine dispute form fields and a drafted narrative
 * from order + adjustment + seller-dispute context.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const parsed = orderIdSchema.safeParse((await context.params).id)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 })
  }

  try {
    const result = await getAdminShipEngineDisputePacketsForOrder(parsed.data)
    if (!result.ok) {
      const status = result.error === "Order not found" ? 404 : 500
      return NextResponse.json({ error: result.error }, { status })
    }
    return NextResponse.json({ data: result.data })
  } catch (error) {
    console.error("[admin shipengine dispute packet]", error)
    return NextResponse.json({ error: "Could not build dispute packet" }, { status: 500 })
  }
}
