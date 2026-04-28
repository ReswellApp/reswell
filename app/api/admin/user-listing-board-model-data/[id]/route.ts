import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { patchUserListingBoardModelDataAdminFields } from "@/lib/db/user-listing-board-model-data"
import { listingDetailHref } from "@/lib/listing-href"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { attachCatalogBrandToUserListingBoardSnapshotService } from "@/lib/services/userListingBoardSnapshotBrandAttach"

const patchSchema = z
  .object({
    admin_notes: z.union([z.string().max(4000), z.null()]).optional(),
    dismissed: z.boolean().optional(),
    brand_id: z.string().uuid().optional(),
  })
  .refine(
    (d) => d.admin_notes !== undefined || d.dismissed !== undefined || d.brand_id !== undefined,
    { message: "Nothing to update" },
  )

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

  if (parsed.data.brand_id !== undefined) {
    if (parsed.data.admin_notes !== undefined || parsed.data.dismissed !== undefined) {
      return NextResponse.json(
        { error: "Attach brand must be the only field in this request" },
        { status: 400 },
      )
    }

    let service: ReturnType<typeof createServiceRoleClient>
    try {
      service = createServiceRoleClient()
    } catch {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
    }

    const attach = await attachCatalogBrandToUserListingBoardSnapshotService(
      service,
      id,
      parsed.data.brand_id,
    )
    if (!attach.ok) {
      return NextResponse.json({ error: attach.error }, { status: attach.status })
    }

    const { data: listingRow } = await service
      .from("listings")
      .select("slug")
      .eq("id", attach.listingId)
      .maybeSingle()
    const slug =
      listingRow && typeof (listingRow as { slug?: string }).slug === "string"
        ? (listingRow as { slug: string }).slug.trim()
        : ""
    revalidatePath(listingDetailHref({ id: attach.listingId, slug: slug || undefined }))

    return NextResponse.json({ ok: true, data: { brand: attach.brand } }, { status: 200 })
  }

  if (parsed.data.admin_notes === undefined && parsed.data.dismissed === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const out: {
    admin_notes?: string | null
    dismissed_at?: string | null
  } = {}

  if (parsed.data.admin_notes !== undefined) {
    out.admin_notes =
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
