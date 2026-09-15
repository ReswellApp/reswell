import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { relatedContentListingIdSchema } from "@/lib/validations/listing-related-content"
import { deleteRelatedContentItemService } from "@/lib/services/listingRelatedContent"

type RouteContext = { params: Promise<{ listingId: string; rowId: string }> }

export async function DELETE(_request: Request, context: RouteContext) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { listingId, rowId } = await context.params
  const parsedListing = relatedContentListingIdSchema.safeParse(listingId)
  const parsedRow = relatedContentListingIdSchema.safeParse(rowId)
  if (!parsedListing.success || !parsedRow.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const result = await deleteRelatedContentItemService(parsedListing.data, parsedRow.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json({ data: { deleted: true } }, { status: 200 })
}
