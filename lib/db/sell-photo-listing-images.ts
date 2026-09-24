import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  SellPhotoLiveListing,
  SellPhotoLiveListingImage,
} from "@/lib/types/sell-photo-match"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const LISTING_SELECT = `
  id,
  title,
  brand,
  model,
  listing_images (id, url, sort_order)
`.trim()

type ImageRow = {
  id?: string | null
  url?: string | null
  sort_order?: number | null
}

type ListingRow = {
  id: string
  title: string | null
  brand: string | null
  model: string | null
  listing_images: ImageRow[] | null
}

function escapeIlikePattern(raw: string): string {
  return raw.replace(/[%_\\]/g, (match) => `\\${match}`)
}

function cleanLabel(value: string | null | undefined): string | null {
  const text = value?.trim() ?? ""
  return text.length > 0 ? text : null
}

function toImages(rows: ImageRow[] | null): SellPhotoLiveListingImage[] {
  const images: SellPhotoLiveListingImage[] = []
  for (const row of rows ?? []) {
    const id = row.id?.trim() ?? ""
    const url = row.url?.trim() ?? ""
    if (!id || !url) continue
    images.push({
      id,
      url,
      sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
    })
  }
  images.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
  return images
}

function toListing(row: ListingRow): SellPhotoLiveListing {
  return {
    id: row.id,
    title: row.title?.trim() || "Untitled listing",
    brand: cleanLabel(row.brand),
    model: cleanLabel(row.model),
    images: toImages(row.listing_images),
  }
}

/**
 * Active surfboard listings for the admin photo-match picker.
 * The saved brand and model are returned so the admin can compare them with the photo match.
 */
export async function searchActiveSurfboardListingsForPhotoMatch(
  supabase: SupabaseClient,
  query: string,
): Promise<SellPhotoLiveListing[]> {
  const q = query.trim()
  if (q.length < 2) return []

  let builder = supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("section", "surfboards")
    .eq("status", "active")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(8)

  if (UUID_REGEX.test(q)) {
    builder = builder.eq("id", q)
  } else {
    const like = `%${escapeIlikePattern(q)}%`
    builder = builder.or(`title.ilike.${like},brand.ilike.${like},model.ilike.${like},slug.ilike.${like}`)
  }

  const { data, error } = await builder
  if (error) {
    console.error("[sellPhotoListingImages] search:", error.message)
    return []
  }
  return ((data ?? []) as unknown as ListingRow[]).map(toListing).filter((listing) => listing.images.length > 0)
}

/** One active surfboard listing, limited to the photo ids the admin selected. */
export async function getActiveSurfboardListingPhotos(
  supabase: SupabaseClient,
  listingId: string,
  imageIds: readonly string[],
): Promise<SellPhotoLiveListing | null> {
  const wanted = new Set(imageIds)
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("id", listingId)
    .eq("section", "surfboards")
    .eq("status", "active")
    .is("archived_at", null)
    .maybeSingle()

  if (error) {
    console.error("[sellPhotoListingImages] listing:", error.message)
    return null
  }
  if (!data) return null
  const listing = toListing(data as unknown as ListingRow)
  return {
    ...listing,
    images: listing.images.filter((image) => wanted.has(image.id)),
  }
}
