import { revalidatePath } from "next/cache"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { listingDetailHref } from "@/lib/listing-href"
import { setAdminListingBrandModel } from "@/lib/services/adminListingBrandModel"
import { adminListingBrandModelBodySchema } from "@/lib/validations/admin-listing-brand-model"

const uuid = z.string().uuid()

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id } = await ctx.params
  if (!uuid.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid listing id" }, { status: 400 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = adminListingBrandModelBodySchema.safeParse(json)
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid body"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  try {
    const result = await setAdminListingBrandModel(id, parsed.data)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    revalidatePath(
      listingDetailHref({
        id: result.listingId,
        slug: result.slug ?? undefined,
        section: "surfboards",
      }),
    )
    revalidatePath("/admin/listings/brand-model-autofills")

    return NextResponse.json({ data: result }, { status: 200 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[admin listing brand-model] PATCH:", msg)
    return NextResponse.json({ error: "Could not update listing" }, { status: 500 })
  }
}
