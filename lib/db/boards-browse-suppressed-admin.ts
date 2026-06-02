import type { SupabaseClient } from "@supabase/supabase-js"
import { listingHeroSlideSrc, type ListingImageForCard } from "@/lib/listing-image-display"

/** True when `listings.suppressed_on_boards_browse` exists (migration applied). */
export async function isBoardsBrowseSuppressionSortAvailable(
  supabase: SupabaseClient,
): Promise<boolean> {
  const { error } = await supabase.from("listings").select("suppressed_on_boards_browse").limit(1)
  if (!error) return true
  const msg = error.message ?? ""
  if (/suppressed_on_boards_browse|column.*does not exist/i.test(msg)) return false
  console.error("isBoardsBrowseSuppressionSortAvailable:", msg)
  return false
}

const ADMIN_SURFBOARD_PICKER_SELECT = `
  id,
  slug,
  title,
  status,
  hidden_from_site,
  suppressed_on_boards_browse,
  listing_images (url, thumbnail_url, is_primary)
`

export type BoardsBrowseSuppressedAdminRow = {
  id: string
  slug: string
  title: string
  status: string | null
  hidden_from_site: boolean | null
  suppressed_on_boards_browse: boolean | null
  primary_image_url: string | null
}

function mapPickerRow(row: {
  id: string
  slug: string
  title: string
  status: string | null
  hidden_from_site: boolean | null
  suppressed_on_boards_browse: boolean | null
  listing_images: ListingImageForCard[] | null
}): BoardsBrowseSuppressedAdminRow {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    hidden_from_site: row.hidden_from_site,
    suppressed_on_boards_browse: row.suppressed_on_boards_browse,
    primary_image_url: listingHeroSlideSrc(row.listing_images),
  }
}

export async function listSuppressedSurfboardsForBoardsAdmin(
  supabase: SupabaseClient,
): Promise<BoardsBrowseSuppressedAdminRow[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(ADMIN_SURFBOARD_PICKER_SELECT)
    .eq("section", "surfboards")
    .eq("suppressed_on_boards_browse", true)
    .order("updated_at", { ascending: false })
    .limit(100)

  if (error) {
    console.error("listSuppressedSurfboardsForBoardsAdmin:", error.message)
    return []
  }

  return (data ?? []).map((row) =>
    mapPickerRow(row as Parameters<typeof mapPickerRow>[0]),
  )
}

export async function searchSurfboardsForBoardsBrowseAdmin(
  supabase: SupabaseClient,
  query: string,
  opts?: { limit?: number; offset?: number },
): Promise<{ hits: BoardsBrowseSuppressedAdminRow[]; total: number }> {
  const q = query.trim()
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100)
  const offset = Math.max(opts?.offset ?? 0, 0)

  let builder = supabase
    .from("listings")
    .select(ADMIN_SURFBOARD_PICKER_SELECT, { count: "exact" })
    .eq("section", "surfboards")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (q) {
    const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`
    builder = builder.ilike("title", like)
  }

  const { data, error, count } = await builder
  if (error) {
    console.error("searchSurfboardsForBoardsBrowseAdmin:", error.message)
    return { hits: [], total: 0 }
  }

  return {
    hits: (data ?? []).map((row) => mapPickerRow(row as Parameters<typeof mapPickerRow>[0])),
    total: count ?? 0,
  }
}
