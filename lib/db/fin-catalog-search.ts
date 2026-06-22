import type { SupabaseClient } from "@supabase/supabase-js"
import { FIN_CATALOG_PRODUCT_CATEGORY } from "@/lib/brand-catalog-fin-variants"
import { listBrandIdsMatchingProductCategories } from "@/lib/db/brand-product-categories"
import type { FinBoxesType, FinBoxType, FinCatalogVariantSize } from "@/lib/validations/brand-model-variants"

export { FIN_CATALOG_PRODUCT_CATEGORY } from "@/lib/brand-catalog-fin-variants"

function escapeIlikeToken(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function ilikePattern(q: string): string {
  const safe = escapeIlikeToken(q.trim())
  return q.trim().length < 4 ? `${safe}%` : `%${safe}%`
}

const MODEL_LIST_SELECT = `
  id,
  brand_id,
  name,
  description,
  image_url,
  brands:brand_id ( id, name, slug, logo_url )
`

type RawBrandModelRow = {
  id: string
  brand_id: string
  name: string
  description: string | null
  image_url: string | null
  brands:
    | { id: string; name: string; slug: string; logo_url: string | null }
    | { id: string; name: string; slug: string; logo_url: string | null }[]
    | null
}

function pickJoinedBrand(
  joined: RawBrandModelRow["brands"],
): { id: string; name: string; slug: string; logo_url: string | null } | null {
  if (!joined) return null
  return Array.isArray(joined) ? joined[0] ?? null : joined
}

export type FinCatalogModelRow = {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  brandId: string
  brandName: string
  brandSlug: string
  brandLogoUrl: string | null
}

export type FinCatalogVariantRow = {
  id: string
  brandId: string
  brandModelId: string
  brandName: string
  brandSlug: string
  brandLogoUrl: string | null
  modelName: string
  modelImageUrl: string | null
  lengthLabel: string
  widthLabel: string
  thicknessLabel: string
  volumeLabel: string
  finBoxType: FinBoxType
  finBoxes: FinBoxesType
  finSize: FinCatalogVariantSize | null
  configurationLabel: string
  finBaseLabel: string
  finHeightLabel: string
  finFoilLabel: string
  finColorLabel: string
  imageUrl: string | null
}

const VARIANT_LIST_SELECT = `
  id,
  brand_id,
  brand_model_id,
  length_label,
  width_label,
  thickness_label,
  volume_label,
  fin_box_type,
  fin_boxes,
  fin_size,
  configuration_label,
  fin_base_label,
  fin_height_label,
  fin_foil_label,
  fin_color_label,
  product_category_slug,
  image_url,
  brand_models:brand_model_id (
    id,
    name,
    image_url,
    product_category_slug,
    brands:brand_id ( id, name, slug, logo_url )
  )
`

type RawVariantRow = {
  id: string
  brand_id: string
  brand_model_id: string
  length_label: string
  width_label: string
  thickness_label: string
  volume_label: string
  fin_box_type: FinBoxType
  fin_boxes: FinBoxesType
  fin_size: FinCatalogVariantSize | null
  configuration_label: string
  fin_base_label: string
  fin_height_label: string
  fin_foil_label: string
  fin_color_label: string
  product_category_slug: string
  image_url: string | null
  brand_models:
    | {
        id: string
        name: string
        image_url: string | null
        product_category_slug?: string
        brands:
          | { id: string; name: string; slug: string; logo_url: string | null }
          | { id: string; name: string; slug: string; logo_url: string | null }[]
          | null
      }
    | {
        id: string
        name: string
        image_url: string | null
        product_category_slug?: string
        brands:
          | { id: string; name: string; slug: string; logo_url: string | null }
          | { id: string; name: string; slug: string; logo_url: string | null }[]
          | null
      }[]
    | null
}

function mapModelRow(row: RawBrandModelRow): FinCatalogModelRow | null {
  const brand = pickJoinedBrand(row.brands)
  if (!brand?.id || !brand.slug?.trim()) return null
  return {
    id: row.id,
    name: row.name.trim(),
    description: row.description?.trim() || null,
    imageUrl: row.image_url?.trim() || null,
    brandId: brand.id,
    brandName: brand.name.trim(),
    brandSlug: brand.slug.trim(),
    brandLogoUrl: brand.logo_url?.trim() || null,
  }
}

function mapVariantRow(row: RawVariantRow): FinCatalogVariantRow | null {
  const modelJoined = row.brand_models
  const model = Array.isArray(modelJoined) ? modelJoined[0] ?? null : modelJoined
  if (!model?.id || !model.name?.trim()) return null
  // Legacy rows may still carry `surfboards` until backfilled; fin scope comes from brand tag.
  if (
    row.product_category_slug !== FIN_CATALOG_PRODUCT_CATEGORY &&
    row.product_category_slug !== "surfboards"
  ) {
    return null
  }
  if (
    model.product_category_slug &&
    model.product_category_slug !== FIN_CATALOG_PRODUCT_CATEGORY &&
    model.product_category_slug !== "surfboards"
  ) {
    return null
  }
  const brand = pickJoinedBrand(model.brands)
  if (!brand?.id || !brand.slug?.trim()) return null
  return {
    id: row.id,
    brandId: brand.id,
    brandModelId: model.id,
    brandName: brand.name.trim(),
    brandSlug: brand.slug.trim(),
    brandLogoUrl: brand.logo_url?.trim() || null,
    modelName: model.name.trim(),
    modelImageUrl: model.image_url?.trim() || null,
    lengthLabel: row.length_label.trim(),
    widthLabel: row.width_label.trim(),
    thicknessLabel: row.thickness_label.trim(),
    volumeLabel: row.volume_label.trim(),
    finBoxType: row.fin_box_type,
    finBoxes: row.fin_boxes,
    finSize: row.fin_size ?? null,
    configurationLabel: row.configuration_label?.trim() ?? "",
    finBaseLabel: row.fin_base_label?.trim() ?? "",
    finHeightLabel: row.fin_height_label?.trim() ?? "",
    finFoilLabel: row.fin_foil_label?.trim() ?? "",
    finColorLabel: row.fin_color_label?.trim() ?? "",
    imageUrl: row.image_url?.trim() || null,
  }
}

/** Brand IDs tagged with the fins product category (`brand_product_categories.category_slug = 'fins'`). */
export async function listFinCatalogBrandIds(supabase: SupabaseClient): Promise<string[]> {
  const ids = await listBrandIdsMatchingProductCategories(supabase, [FIN_CATALOG_PRODUCT_CATEGORY])
  return ids ?? []
}

const FIN_BRAND_LIST_SELECT =
  "id, name, slug, short_description, logo_url, location_label, lead_shaper_name" as const

export type FinCatalogBrandRow = {
  id: string
  name: string
  slug: string
  short_description: string | null
  logo_url: string | null
  location_label: string | null
  lead_shaper_name: string | null
}

/** Match fin brand names by word starts or initials (e.g. `pv` → Pacific Vibrations). */
function finBrandMatchesQuery(name: string, slug: string, q: string): boolean {
  const query = q.trim().toLowerCase()
  if (!query) return false

  const nameLower = name.trim().toLowerCase()
  const slugLower = slug.trim().toLowerCase()
  if (nameLower.includes(query) || slugLower.includes(query)) return true

  const words = name.match(/[\w']+/g) ?? []
  if (words.some((word) => word.toLowerCase().startsWith(query))) return true

  const initials = words.map((word) => word[0]?.toLowerCase() ?? "").join("")
  return initials.startsWith(query)
}

/** Search `brands` limited to fin-tagged brand IDs. */
export async function searchFinCatalogBrands(
  supabase: SupabaseClient,
  finBrandIds: readonly string[],
  qRaw: string,
  limit = 8,
): Promise<FinCatalogBrandRow[]> {
  const q = qRaw.trim()
  if (q.length < 1 || finBrandIds.length === 0) return []

  const pattern = ilikePattern(q)
  const { data, error } = await supabase
    .from("brands")
    .select(FIN_BRAND_LIST_SELECT)
    .in("id", [...finBrandIds])
    .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
    .order("name", { ascending: true })
    .limit(limit)

  if (error) {
    console.error("searchFinCatalogBrands:", error.message)
    return []
  }

  const rows = (data ?? []) as FinCatalogBrandRow[]
  if (rows.length >= limit || q.length >= 4) return rows

  const seen = new Set(rows.map((row) => row.id))
  const { data: allFinBrands, error: allErr } = await supabase
    .from("brands")
    .select(FIN_BRAND_LIST_SELECT)
    .in("id", [...finBrandIds])
    .order("name", { ascending: true })

  if (allErr) {
    console.error("searchFinCatalogBrands (initials fallback):", allErr.message)
    return rows
  }

  const merged = [...rows]
  for (const row of (allFinBrands ?? []) as FinCatalogBrandRow[]) {
    if (seen.has(row.id)) continue
    if (!finBrandMatchesQuery(row.name, row.slug, q)) continue
    merged.push(row)
    seen.add(row.id)
    if (merged.length >= limit) break
  }

  return merged
}

/** Typeahead on `brand_models` limited to fin-tagged brands. */
export async function searchFinCatalogModels(
  supabase: SupabaseClient,
  finBrandIds: readonly string[],
  qRaw: string,
  limit = 12,
): Promise<FinCatalogModelRow[]> {
  const q = qRaw.trim()
  if (q.length < 1 || finBrandIds.length === 0) return []

  const pattern = ilikePattern(q)
  const { data, error } = await supabase
    .from("brand_models")
    .select(MODEL_LIST_SELECT)
    .in("brand_id", [...finBrandIds])
    .or(`name.ilike.${pattern},description.ilike.${pattern}`)
    .order("name", { ascending: true })
    .limit(limit)

  if (error) {
    console.error("searchFinCatalogModels:", error.message)
    return []
  }

  const out: FinCatalogModelRow[] = []
  for (const row of (data ?? []) as RawBrandModelRow[]) {
    const mapped = mapModelRow(row)
    if (mapped) out.push(mapped)
  }
  return out
}

/** Models for matched fin brands (e.g. user typed a brand name). */
export async function listFinCatalogModelsForBrandIds(
  supabase: SupabaseClient,
  finBrandIds: readonly string[],
  brandIds: readonly string[],
  qRaw: string,
  limit = 12,
): Promise<FinCatalogModelRow[]> {
  const allowed = new Set(finBrandIds)
  const filteredBrandIds = brandIds.filter((id) => allowed.has(id))
  if (filteredBrandIds.length === 0) return []

  const q = qRaw.trim()
  let query = supabase
    .from("brand_models")
    .select(MODEL_LIST_SELECT)
    .in("brand_id", filteredBrandIds)
    .order("name", { ascending: true })
    .limit(limit)

  if (q.length >= 1) {
    const pattern = ilikePattern(q)
    query = query.or(`name.ilike.${pattern},description.ilike.${pattern}`)
  }

  const { data, error } = await query
  if (error) {
    console.error("listFinCatalogModelsForBrandIds:", error.message)
    return []
  }

  const out: FinCatalogModelRow[] = []
  for (const row of (data ?? []) as RawBrandModelRow[]) {
    const mapped = mapModelRow(row)
    if (mapped) out.push(mapped)
  }
  return out
}

type VariantSearchOptions = {
  finBrandIds: readonly string[]
  qRaw: string
  finSystems?: readonly FinBoxType[]
  finSetups?: readonly FinBoxesType[]
  finSizes?: readonly string[]
  brandModelIds?: readonly string[]
  limit?: number
}

/** Search `brand_model_variants` for fin-tagged brands by labels and/or facet slugs. */
export async function searchFinCatalogVariants(
  supabase: SupabaseClient,
  options: VariantSearchOptions,
): Promise<FinCatalogVariantRow[]> {
  const { finBrandIds, qRaw, finSystems = [], finSetups = [], finSizes = [], brandModelIds = [] } =
    options
  const limit = options.limit ?? 12
  if (finBrandIds.length === 0) return []

  const q = qRaw.trim()
  const pattern = q.length >= 1 ? ilikePattern(q) : null
  const byId = new Map<string, FinCatalogVariantRow>()

  const collect = (rows: RawVariantRow[]) => {
    for (const row of rows) {
      const mapped = mapVariantRow(row)
      if (mapped) byId.set(mapped.id, mapped)
    }
  }

  if (pattern) {
    const { data, error } = await supabase
      .from("brand_model_variants")
      .select(VARIANT_LIST_SELECT)
      .in("brand_id", [...finBrandIds])
      .or(
        [
          `length_label.ilike.${pattern}`,
          `width_label.ilike.${pattern}`,
          `thickness_label.ilike.${pattern}`,
          `volume_label.ilike.${pattern}`,
          `configuration_label.ilike.${pattern}`,
          `fin_base_label.ilike.${pattern}`,
          `fin_height_label.ilike.${pattern}`,
          `fin_foil_label.ilike.${pattern}`,
          `fin_color_label.ilike.${pattern}`,
        ].join(","),
      )
      .order("sort_order", { ascending: true })
      .limit(limit)

    if (error) {
      console.error("searchFinCatalogVariants (labels):", error.message)
    } else {
      collect((data ?? []) as RawVariantRow[])
    }
  }

  if (brandModelIds.length > 0) {
    const { data, error } = await supabase
      .from("brand_model_variants")
      .select(VARIANT_LIST_SELECT)
      .in("brand_id", [...finBrandIds])
      .in("brand_model_id", [...brandModelIds])
      .order("sort_order", { ascending: true })
      .limit(limit)

    if (error) {
      console.error("searchFinCatalogVariants (model ids):", error.message)
    } else {
      collect((data ?? []) as RawVariantRow[])
    }
  }

  if (finSystems.length > 0) {
    const { data, error } = await supabase
      .from("brand_model_variants")
      .select(VARIANT_LIST_SELECT)
      .in("brand_id", [...finBrandIds])
      .in("fin_box_type", [...finSystems])
      .order("sort_order", { ascending: true })
      .limit(limit)

    if (error) {
      console.error("searchFinCatalogVariants (fin system):", error.message)
    } else {
      collect((data ?? []) as RawVariantRow[])
    }
  }

  if (finSetups.length > 0) {
    const { data, error } = await supabase
      .from("brand_model_variants")
      .select(VARIANT_LIST_SELECT)
      .in("brand_id", [...finBrandIds])
      .in("fin_boxes", [...finSetups])
      .order("sort_order", { ascending: true })
      .limit(limit)

    if (error) {
      console.error("searchFinCatalogVariants (fin setup):", error.message)
    } else {
      collect((data ?? []) as RawVariantRow[])
    }
  }

  if (finSizes.length > 0) {
    const { data, error } = await supabase
      .from("brand_model_variants")
      .select(VARIANT_LIST_SELECT)
      .in("brand_id", [...finBrandIds])
      .in("fin_size", [...finSizes])
      .order("sort_order", { ascending: true })
      .limit(limit)

    if (error) {
      console.error("searchFinCatalogVariants (fin size):", error.message)
    } else {
      collect((data ?? []) as RawVariantRow[])
    }
  }

  return [...byId.values()].slice(0, limit)
}
