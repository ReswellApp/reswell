import { createServiceRoleClient } from "@/lib/supabase/server"
import { boardTypeFromCategoryId } from "@/lib/utils/board-type-from-category-id"
import { updateListingCategoryRow } from "@/lib/db/listings"

export async function setAdminListingCategory(params: {
  listingId: string
  categoryId: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, message: "Server misconfigured" }
  }

  const { data: listing, error: listingErr } = await service
    .from("listings")
    .select("id, section")
    .eq("id", params.listingId)
    .maybeSingle()

  if (listingErr) {
    return { ok: false, message: listingErr.message }
  }
  if (!listing) {
    return { ok: false, message: "Listing not found" }
  }

  const section = listing.section
  if (section !== "new" && section !== "surfboards") {
    return { ok: false, message: "Unsupported listing section" }
  }

  const { data: category, error: catErr } = await service
    .from("categories")
    .select("id, board")
    .eq("id", params.categoryId)
    .maybeSingle()

  if (catErr) {
    return { ok: false, message: catErr.message }
  }
  if (!category) {
    return { ok: false, message: "Category not found" }
  }

  const isBoardCategory = category.board === true
  if (section === "surfboards" && !isBoardCategory) {
    return {
      ok: false,
      message: "Pick a surfboard category for this listing (shop categories cannot be used).",
    }
  }
  if (section === "new" && isBoardCategory) {
    return {
      ok: false,
      message: "Pick a shop category for this listing (surfboard shapes cannot be used).",
    }
  }

  if (section === "surfboards") {
    return updateListingCategoryRow(service, params.listingId, {
      category_id: params.categoryId,
      board_type: boardTypeFromCategoryId(params.categoryId),
    })
  }

  return updateListingCategoryRow(service, params.listingId, {
    category_id: params.categoryId,
  })
}
