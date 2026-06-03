import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  searchCurationIdParamSchema,
  updateSearchSynonymSchema,
} from "@/lib/validations/searchCuration"
import { deleteSearchSynonym, updateSearchSynonym } from "@/lib/db/searchCuration"
import { revalidateSearchSynonyms } from "@/lib/services/searchSynonyms"

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
  const parsed = updateSearchSynonymSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update" }, { status: 400 })
  }

  const { data, error } = await updateSearchSynonym(gate.ctx.supabase, idParse.data.id, parsed.data)
  if (error || !data) {
    const duplicate = error?.message?.includes("search_synonyms_term_unique")
    return NextResponse.json(
      { error: duplicate ? "A synonym for that term already exists" : "Could not update synonym" },
      { status: duplicate ? 409 : 500 },
    )
  }

  revalidateSearchSynonyms()
  return NextResponse.json({ data: { synonym: data } }, { status: 200 })
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

  const { error } = await deleteSearchSynonym(gate.ctx.supabase, idParse.data.id)
  if (error) {
    return NextResponse.json({ error: "Could not delete synonym" }, { status: 500 })
  }

  revalidateSearchSynonyms()
  return NextResponse.json({ data: { ok: true } }, { status: 200 })
}
