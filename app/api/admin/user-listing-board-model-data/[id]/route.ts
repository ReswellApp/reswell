import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { listingDetailHref } from "@/lib/listing-href"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { attachCatalogBrandToUserListingBoardSnapshotService } from "@/lib/services/userListingBoardSnapshotBrandAttach"

const patchSchema = z.object({
  brand_id: z.string().uuid(),
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
