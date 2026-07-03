import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  adminPartnerEmbedListingBodySchema,
  adminPartnerEmbedReorderBodySchema,
} from "@/lib/validations/partner-listing-embeds"
import {
  addPartnerEmbedListingService,
  reorderPartnerEmbedListingsService,
} from "@/lib/services/partnerListingEmbeds"
import { listPartnerEmbedCurationRows } from "@/lib/db/partner-listing-embeds"

type RouteContext = { params: Promise<{ embedId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { embedId } = await context.params
  const rows = await listPartnerEmbedCurationRows(gate.ctx.supabase, embedId)
  return NextResponse.json({ data: { rows } }, { status: 200 })
}

export async function POST(request: Request, context: RouteContext) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { embedId } = await context.params

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = adminPartnerEmbedListingBodySchema.safeParse(json)
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const result = await addPartnerEmbedListingService({
    embedId,
    listingId: parsed.data.listing_id,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json({ data: { id: result.id } }, { status: 201 })
}

export async function PATCH(request: Request, context: RouteContext) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { embedId } = await context.params

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = adminPartnerEmbedReorderBodySchema.safeParse(json)
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const result = await reorderPartnerEmbedListingsService(embedId, parsed.data.ordered_row_ids)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json({ data: { reordered: true } }, { status: 200 })
}
