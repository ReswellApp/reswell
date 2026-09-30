import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  KlaviyoListingImage,
  KlaviyoListingProductSource,
} from "@/lib/klaviyo/catalog-product"

const EMAIL_STUDIO_PRODUCT_SELECT = `
  id,
  slug,
  title,
  price,
  section,
  board_type,
  condition,
  dimensions,
  status,
  hidden_from_site,
  archived_at,
  listing_images ( url, thumbnail_url, is_primary, sort_order )
`.trim()

export interface EmailStudioProductRow extends KlaviyoListingProductSource {
  dimensions: string | null
  status: string
  hidden_from_site: boolean | null
  archived_at: string | null
  listing_images?: KlaviyoListingImage[] | null
}

export async function searchEmailStudioProductRows(
  supabase: SupabaseClient,
  query: string,
  limit = 12,
): Promise<EmailStudioProductRow[]> {
  let builder = supabase
    .from("listings")
    .select(EMAIL_STUDIO_PRODUCT_SELECT)
    .order("updated_at", { ascending: false })
    .limit(Math.min(20, Math.max(1, limit)))

  const normalized = query.trim().replace(/[%_]/g, "")
  if (normalized) builder = builder.ilike("title", `%${normalized}%`)

  const { data, error } = await builder
  if (error) throw new Error(error.message)
  return Array.isArray(data) ? data as unknown as EmailStudioProductRow[] : []
}

export async function fetchEmailStudioProductRowsByIds(
  supabase: SupabaseClient,
  listingIds: readonly string[],
): Promise<EmailStudioProductRow[]> {
  const ids = [...new Set(listingIds)]
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from("listings")
    .select(EMAIL_STUDIO_PRODUCT_SELECT)
    .in("id", ids)

  if (error) throw new Error(error.message)
  return Array.isArray(data) ? data as unknown as EmailStudioProductRow[] : []
}
