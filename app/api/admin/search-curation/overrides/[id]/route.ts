import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  searchCurationIdParamSchema,
  updateSearchOverrideSchema,
} from "@/lib/validations/searchCuration"
import { deleteSearchOverride, updateSearchOverride } from "@/lib/db/searchCuration"
import { revalidateSearchOverrides } from "@/lib/services/searchResultOverrides"

export async function PATCH(
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
  const parsed = updateSearchOverrideSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update" }, { status: 400 })
  }

  const { error } = await updateSearchOverride(gate.ctx.supabase, idParse.data.id, parsed.data)
  if (error) {
    return NextResponse.json({ error: "Could not update override" }, { status: 500 })
  }

  revalidateSearchOverrides()
  return NextResponse.json({ data: { ok: true } }, { status: 200 })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const idParse = searchCurationIdParamSchema.safeParse(await params)
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const { error } = await deleteSearchOverride(gate.ctx.supabase, idParse.data.id)
  if (error) {
    return NextResponse.json({ error: "Could not delete override" }, { status: 500 })
  }

  revalidateSearchOverrides()
  return NextResponse.json({ data: { ok: true } }, { status: 200 })
}
