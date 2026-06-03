import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  createSearchOverrideSchema,
  normalizeSearchCurationKey,
} from "@/lib/validations/searchCuration"
import { listSearchOverridesWithListings, upsertSearchOverride } from "@/lib/db/searchCuration"
import { revalidateSearchOverrides } from "@/lib/services/searchResultOverrides"

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { data, error } = await listSearchOverridesWithListings(gate.ctx.supabase)
  if (error) {
    return NextResponse.json({ error: "Could not load overrides" }, { status: 500 })
  }
  return NextResponse.json({ data: { overrides: data } }, { status: 200 })
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const raw = await request.json().catch(() => null)
  const parsed = createSearchOverrideSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a query" }, { status: 400 })
  }

  const queryDisplay = parsed.data.query.trim()
  const queryNormalized = normalizeSearchCurationKey(queryDisplay)
  if (!queryNormalized) {
    return NextResponse.json({ error: "Enter a valid query" }, { status: 400 })
  }

  const { data, error } = await upsertSearchOverride(gate.ctx.supabase, gate.ctx.user.id, {
    queryNormalized,
    queryDisplay,
    note: parsed.data.note,
    enabled: parsed.data.enabled,
  })

  if (error || !data) {
    return NextResponse.json({ error: "Could not save override" }, { status: 500 })
  }

  revalidateSearchOverrides()
  return NextResponse.json({ data: { id: data.id } }, { status: 201 })
}
