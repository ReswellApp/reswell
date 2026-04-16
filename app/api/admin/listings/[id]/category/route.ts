import { revalidatePath } from "next/cache"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { setAdminListingCategory } from "@/lib/services/adminListingCategory"
import { adminListingCategoryBodySchema } from "@/lib/validations/admin-listing-category"

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

  const parsed = adminListingCategoryBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await setAdminListingCategory({
    listingId: listingId.trim(),
    categoryId: parsed.data.category_id,
  })

  if (!result.ok) {
    const notFound =
      result.message === "Listing not found" || result.message === "Category not found"
    return NextResponse.json({ error: result.message }, { status: notFound ? 404 : 400 })
  }

  const supabaseForEs = await createClient()
  await syncListingToIndex(supabaseForEs, listingId.trim())

  const { data: listingRow } = await supabaseForEs
    .from("listings")
    .select("slug")
    .eq("id", listingId.trim())
    .maybeSingle()
  const slug =
    listingRow && typeof (listingRow as { slug?: unknown }).slug === "string"
      ? String((listingRow as { slug: string }).slug).trim()
      : ""
  if (slug) {
    revalidatePath(`/l/${slug}`, "page")
  }

  revalidatePath("/boards")
  revalidatePath("/feed")
  revalidatePath("/search")
  revalidatePath("/shop")
  revalidatePath("/")
  revalidatePath("/sellers")

  return NextResponse.json({ success: true })
}
