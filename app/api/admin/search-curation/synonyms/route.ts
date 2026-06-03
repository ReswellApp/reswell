import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { createSearchSynonymSchema } from "@/lib/validations/searchCuration"
import { insertSearchSynonym, listSearchSynonyms } from "@/lib/db/searchCuration"
import { revalidateSearchSynonyms } from "@/lib/services/searchSynonyms"

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { data, error } = await listSearchSynonyms(gate.ctx.supabase)
  if (error) {
    return NextResponse.json({ error: "Could not load synonyms" }, { status: 500 })
  }
  return NextResponse.json({ data: { synonyms: data } }, { status: 200 })
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const raw = await request.json().catch(() => null)
  const parsed = createSearchSynonymSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a term and at least one expansion" }, { status: 400 })
  }

  const { data, error } = await insertSearchSynonym(gate.ctx.supabase, gate.ctx.user.id, {
    term: parsed.data.term,
    expansions: parsed.data.expansions,
    enabled: parsed.data.enabled,
  })

  if (error || !data) {
    const duplicate = error?.message?.includes("search_synonyms_term_unique")
    return NextResponse.json(
      { error: duplicate ? "A synonym for that term already exists" : "Could not save synonym" },
      { status: duplicate ? 409 : 500 },
    )
  }

  revalidateSearchSynonyms()
  return NextResponse.json({ data: { synonym: data } }, { status: 201 })
}
