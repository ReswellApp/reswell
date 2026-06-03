import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { insertBrandModelRequest } from "@/lib/db/brand-model-requests"

const bodySchema = z.object({
  query: z.string().trim().min(1).max(120),
  insightId: z.string().trim().max(200).optional(),
})

/**
 * Files an unmet-demand search term into the existing brand/model catalog request
 * queue (/admin/listings/brand-requests) as a free-text brand entry, so staff can
 * recruit the brand or add it to the catalog.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .single()
  if (!profile?.is_admin && !profile?.is_employee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const term = parsed.data.query.trim()
  const result = await insertBrandModelRequest(supabase, {
    userId: user.id,
    sellerBrandName: term,
    requestedModelName: term,
    notes: `Logged from Search analytics unmet-demand insight${
      parsed.data.insightId ? ` (${parsed.data.insightId})` : ""
    }.`,
  })

  if (!result.ok) {
    return NextResponse.json({ error: "Could not queue request" }, { status: 500 })
  }

  return NextResponse.json({ data: { ok: true } }, { status: 200 })
}
