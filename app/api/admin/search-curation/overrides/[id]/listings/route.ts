import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  addSearchOverrideListingSchema,
  searchCurationIdParamSchema,
} from "@/lib/validations/searchCuration"
import { addSearchOverrideListing } from "@/lib/db/searchCuration"
import { revalidateSearchOverrides } from "@/lib/services/searchResultOverrides"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const idParse = searchCurationIdParamSchema.safeParse(await params)
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = addSearchOverrideListingSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid listing" }, { status: 400 })
  }

  const result = await addSearchOverrideListing(
    gate.ctx.supabase,
    idParse.data.id,
    parsed.data.listingId,
  )
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.alreadyExists ? 409 : 500 })
  }

  revalidateSearchOverrides()
  return NextResponse.json({ data: { id: result.id } }, { status: 201 })
}
