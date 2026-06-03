import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { deleteSearchOverrideListing } from "@/lib/db/searchCuration"
import { revalidateSearchOverrides } from "@/lib/services/searchResultOverrides"

const paramsSchema = z.object({
  id: z.string().trim().uuid(),
  rowId: z.string().trim().uuid(),
})

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; rowId: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const parsed = paramsSchema.safeParse(await params)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const { error } = await deleteSearchOverrideListing(gate.ctx.supabase, parsed.data.rowId)
  if (error) {
    return NextResponse.json({ error: "Could not remove listing" }, { status: 500 })
  }

  revalidateSearchOverrides()
  return NextResponse.json({ data: { ok: true } }, { status: 200 })
}
