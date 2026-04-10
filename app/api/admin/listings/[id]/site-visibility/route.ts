import { revalidatePath, revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { setListingSiteVisibility } from "@/lib/services/listingSiteVisibility"
import { listingSiteVisibilityBodySchema } from "@/lib/validations/listing-site-visibility"

const SUPER_ADMIN_EMAIL = "haydensbsb@gmail.com"

function canModerate(
  email: string | undefined,
  profile: { is_admin?: boolean | null; is_employee?: boolean | null } | null,
): boolean {
  if (!email) return false
  if (email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return true
  return profile?.is_admin === true || profile?.is_employee === true
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .single()

  if (!canModerate(user.email ?? undefined, profile)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: listingId } = await context.params
  if (!listingId?.trim()) {
    return NextResponse.json({ error: "Missing listing id" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = listingSiteVisibilityBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await setListingSiteVisibility({
    listingId: listingId.trim(),
    hiddenFromSite: parsed.data.hidden_from_site,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 })
  }

  const supabaseForEs = await createClient()
  await syncListingToIndex(supabaseForEs, listingId.trim())

  revalidatePath("/boards")
  revalidatePath("/feed")
  revalidatePath("/search")
  revalidatePath("/shop")
  revalidatePath("/")
  revalidatePath("/sellers")
  revalidatePath("/l/[listing]", "page")
  revalidateTag("sold-feed-stats")

  return NextResponse.json({ success: true })
}
