import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { patchUserListingBoardModelDataAdminFields } from "@/lib/db/user-listing-board-model-data"

const patchSchema = z.object({
  admin_notes: z.union([z.string().max(4000), z.null()]).optional(),
  dismissed: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(json)
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid body"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  if (parsed.data.admin_notes === undefined && parsed.data.dismissed === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const out: {
    admin_notes?: string | null
    dismissed_at?: string | null
  } = {}

  if (parsed.data.admin_notes !== undefined) {    out.admin_notes =
      parsed.data.admin_notes !== null ? parsed.data.admin_notes.trim().slice(0, 4000) : null
  }

  if (parsed.data.dismissed === true) {
    out.dismissed_at = new Date().toISOString()
  } else if (parsed.data.dismissed === false) {
    out.dismissed_at = null
  }

  const result = await patchUserListingBoardModelDataAdminFields(gate.ctx.supabase, id, out)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true }, { status: 200 })
}
