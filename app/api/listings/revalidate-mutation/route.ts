import { after, NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"
import { revalidateNavSearchSuggest } from "@/lib/cache/revalidate-nav-search-suggest"
import { revalidateNavSuggestedSurfboards } from "@/lib/cache/revalidate-nav-suggested-surfboards"
import { revalidateSellersDirectoryCatalog } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { createClient } from "@/lib/supabase/server"

const bodySchema = z.object({
  listingId: z.string().uuid(),
  slug: z.string().nullable().optional(),
  navSearch: z.boolean().optional(),
})

/**
 * Cache revalidation after a listing write. Route handler so calling this from
 * /sell never POSTs a Server Action to the sell URL (which aborts the save).
 */
export async function POST(request: NextRequest) {
  const { user } = await resolveServerAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid listing reference" }, { status: 400 })
  }

  const { listingId, slug, navSearch } = parsed.data
  const supabase = await createClient()
  const { data: sellerProfile } = await supabase
    .from("profiles")
    .select("seller_slug")
    .eq("id", user.id)
    .maybeSingle()
  const sellerSlug =
    typeof sellerProfile?.seller_slug === "string" ? sellerProfile.seller_slug.trim() : ""

  after(() => {
    revalidateListingDetailPage(listingId, slug ?? null)
    revalidateBoardsBrowseCatalog()
    revalidateNavSuggestedSurfboards()
    if (sellerSlug) {
      revalidatePath(`/sellers/${sellerSlug}`, "page")
    }
    revalidateSellersDirectoryCatalog()
    if (navSearch === true) {
      revalidateNavSearchSuggest()
    }
  })

  return NextResponse.json({ data: { ok: true } }, { status: 200 })
}
