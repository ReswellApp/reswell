import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  deleteFbMarketplaceCatalogRow,
  getFbMarketplaceCatalogById,
  updateFbMarketplaceCatalogRow,
} from "@/lib/db/fb-marketplace-catalog"
import { fbMarketplaceCatalogUpdateSchema } from "@/lib/validations/fb-marketplace-catalog"

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  const result = await getFbMarketplaceCatalogById(gate.ctx.supabase, id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }

  return NextResponse.json({ row: result.row })
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = fbMarketplaceCatalogUpdateSchema.safeParse(json)
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const { id } = await ctx.params
  const result = await updateFbMarketplaceCatalogRow(gate.ctx.supabase, id, parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ row: result.row })
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  const result = await deleteFbMarketplaceCatalogRow(gate.ctx.supabase, id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
