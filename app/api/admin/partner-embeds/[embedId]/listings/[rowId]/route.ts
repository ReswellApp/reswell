import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { deletePartnerEmbedListingService } from "@/lib/services/partnerListingEmbeds"

type RouteContext = { params: Promise<{ embedId: string; rowId: string }> }

export async function DELETE(_request: Request, context: RouteContext) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { rowId } = await context.params
  const result = await deletePartnerEmbedListingService(rowId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json({ data: { deleted: true } }, { status: 200 })
}
