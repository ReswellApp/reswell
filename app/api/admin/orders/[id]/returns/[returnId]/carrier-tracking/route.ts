import { NextResponse } from "next/server"
import { z } from "zod"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { getOrderReturnCarrierTracking } from "@/lib/services/orderReturnCarrierTracking"

export const dynamic = "force-dynamic"

const uuidSchema = z.string().uuid()

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; returnId: string }> },
) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const { id, returnId } = await context.params
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(returnId).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const result = await getOrderReturnCarrierTracking({
    supabase,
    orderId: id,
    returnId,
  })

  if (result.fetchError === "Return not found") {
    return NextResponse.json({ error: "Return not found" }, { status: 404 })
  }

  return NextResponse.json({
    data: result.data,
    live: result.live,
    fetchError: result.fetchError,
    marketplace: result.marketplace,
  })
}
