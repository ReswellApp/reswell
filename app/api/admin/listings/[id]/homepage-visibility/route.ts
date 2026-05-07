import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/brands/admin-server"
import { listingHomepageVisibilityBodySchema } from "@/lib/validations/listing-homepage-visibility"
import { setListingHomepageVisibility } from "@/lib/services/listingHomepageVisibility"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id: rawListingId } = await ctx.params
  const listingId = typeof rawListingId === "string" ? decodeURIComponent(rawListingId.trim()) : ""
  if (!listingId || !UUID_RE.test(listingId)) {
    return NextResponse.json({ error: "Invalid listing id" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = listingHomepageVisibilityBodySchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const result = await setListingHomepageVisibility({
    listingId,
    hiddenFromHomepage: parsed.data.hidden_from_homepage,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 })
  }

  revalidatePath("/", "layout")
  revalidatePath("/", "page")
  return NextResponse.json({ success: true }, { status: 200 })
}
