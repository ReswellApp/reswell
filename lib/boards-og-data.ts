import { createClient } from "@/lib/supabase/server"
import { capitalizeWords } from "@/lib/listing-labels"
import { primaryListingImageUrl } from "@/lib/listing-metadata"
import { boardTypeForDbFromBrowseParam, boardsBrowseBoardTypeLabel } from "@/lib/marketplace-slug-metadata"

export type BoardsOgPayload =
  | { ok: false }
  | {
      ok: true
      title: string
      line2?: string
      photoUrl?: string
    }

/**
 * Latest active surfboard listing for OG share art (`/api/og/boards`, `opengraph-image` fallback).
 * Ordered by `created_at` descending to match “newest listing” intent.
 */
export async function getBoardsBrowseOgPayload(typeParam: string | undefined): Promise<BoardsOgPayload> {
  const supabase = await createClient()

  let q = supabase
    .from("listings")
    .select(
      `
      id,
      title,
      price,
      city,
      state,
      board_type,
      listing_images (url, thumbnail_url, is_primary, sort_order)
    `,
    )
    .eq("status", "active")
    .eq("section", "surfboards")
    .eq("hidden_from_site", false)

  const raw = typeParam?.trim()
  if (raw && raw !== "all") {
    const dbType = boardTypeForDbFromBrowseParam(raw)
    if (dbType) {
      q = q.eq("board_type", dbType)
    }
  }

  const { data: row, error } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle()

  if (error || !row) {
    return { ok: false }
  }

  const photoUrl = primaryListingImageUrl(row.listing_images)
  const rawTitle = typeof row.title === "string" ? row.title.trim() : ""
  const displayTitle = capitalizeWords(rawTitle || "Surfboard")

  const price = typeof row.price === "number" ? row.price : Number.parseFloat(String(row.price ?? ""))
  const priceLine = Number.isFinite(price) ? `$${price.toFixed(2)}` : undefined
  const loc =
    row.city && row.state
      ? `${row.city}, ${row.state}`
      : row.city || row.state
        ? String(row.city || row.state)
        : undefined

  const catLabel = boardsBrowseBoardTypeLabel(raw)

  const line2Parts = [catLabel, priceLine, loc].filter((p): p is string => Boolean(p && p.trim()))
  const line2 = line2Parts.length > 0 ? line2Parts.join(" · ") : undefined

  return {
    ok: true,
    title: displayTitle,
    line2,
    photoUrl,
  }
}
