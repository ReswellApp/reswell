import type { SupabaseClient } from "@supabase/supabase-js"
import { FIN_CATALOG_PRODUCT_CATEGORY } from "@/lib/brand-catalog-fin-variants"
import { listBrandIdsMatchingProductCategories } from "@/lib/db/brand-product-categories"
import { getElasticsearchClient } from "./client"
import { ELASTICSEARCH_FIN_CATALOG_INDEX } from "./config"
import { compactSearchKey } from "@/lib/utils/fin-catalog-search-rank"

export type FinCatalogEsKind = "brand" | "model" | "variant"

export type FinCatalogEsDoc = {
  kind: FinCatalogEsKind
  entity_id: string
  brand_id: string
  brand_name: string
  brand_slug: string
  model_id: string
  model_name: string
  title: string
  search_blob: string
  name_compact: string
  fin_box_type: string
  fin_boxes: string
  fin_size: string
  configuration_label: string
  fin_base_label: string
  fin_height_label: string
  fin_foil_label: string
  fin_color_label: string
}

export type FinCatalogEsHit = {
  kind: FinCatalogEsKind
  id: string
  score: number
}

const INDEX_SETTINGS = {
  analysis: {
    filter: {
      fin_synonyms: {
        type: "synonym" as const,
        synonyms: [
          "ta, trueames => true, ames",
          "ci => channel, islands",
          "pv => pacific, vibrations",
          "fcs2, fcsii => fcs",
          "tri => thruster",
        ],
      },
      fin_edge_ngram: {
        type: "edge_ngram" as const,
        min_gram: 2,
        max_gram: 20,
      },
    },
    analyzer: {
      fin_text: {
        type: "custom" as const,
        tokenizer: "standard",
        filter: ["lowercase", "asciifolding", "fin_synonyms"],
      },
      fin_edge: {
        type: "custom" as const,
        tokenizer: "standard",
        filter: ["lowercase", "asciifolding", "fin_edge_ngram"],
      },
    },
    normalizer: {
      lowercase: {
        type: "custom" as const,
        filter: ["lowercase", "asciifolding"],
      },
    },
  },
}

const TEXT_WITH_EDGE = {
  type: "text" as const,
  analyzer: "fin_text",
  fields: {
    edge: { type: "text" as const, analyzer: "fin_edge", search_analyzer: "fin_text" },
    keyword: { type: "keyword" as const, normalizer: "lowercase" },
  },
}

const INDEX_MAPPINGS = {
  properties: {
    kind: { type: "keyword" as const },
    entity_id: { type: "keyword" as const },
    brand_id: { type: "keyword" as const },
    brand_name: TEXT_WITH_EDGE,
    brand_slug: TEXT_WITH_EDGE,
    model_id: { type: "keyword" as const },
    model_name: TEXT_WITH_EDGE,
    title: TEXT_WITH_EDGE,
    search_blob: { type: "text" as const, analyzer: "fin_text" },
    name_compact: { type: "keyword" as const, normalizer: "lowercase" },
    fin_box_type: { type: "keyword" as const },
    fin_boxes: { type: "keyword" as const },
    fin_size: { type: "keyword" as const },
    configuration_label: { type: "text" as const, analyzer: "fin_text" },
    fin_base_label: { type: "text" as const, analyzer: "fin_text" },
    fin_height_label: { type: "text" as const, analyzer: "fin_text" },
    fin_foil_label: { type: "text" as const, analyzer: "fin_text" },
    fin_color_label: { type: "text" as const, analyzer: "fin_text" },
  },
}

export function finCatalogEsDocId(kind: FinCatalogEsKind, entityId: string): string {
  return `${kind}:${entityId}`
}

function escapeElasticsearchWildcard(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/[*?]/g, "\\$&")
}

function emptyLabels(): Pick<
  FinCatalogEsDoc,
  | "fin_box_type"
  | "fin_boxes"
  | "fin_size"
  | "configuration_label"
  | "fin_base_label"
  | "fin_height_label"
  | "fin_foil_label"
  | "fin_color_label"
> {
  return {
    fin_box_type: "",
    fin_boxes: "",
    fin_size: "",
    configuration_label: "",
    fin_base_label: "",
    fin_height_label: "",
    fin_foil_label: "",
    fin_color_label: "",
  }
}

export function finCatalogBrandToEsDoc(row: {
  id: string
  name: string
  slug: string
  short_description?: string | null
}): FinCatalogEsDoc {
  const brandName = row.name?.trim() ?? ""
  const slug = row.slug?.trim() ?? ""
  const desc = row.short_description?.trim() ?? ""
  return {
    kind: "brand",
    entity_id: row.id,
    brand_id: row.id,
    brand_name: brandName,
    brand_slug: slug,
    model_id: "",
    model_name: "",
    title: brandName,
    search_blob: [brandName, slug, desc].filter(Boolean).join(" "),
    name_compact: compactSearchKey(brandName),
    ...emptyLabels(),
  }
}

export function finCatalogModelToEsDoc(row: {
  id: string
  name: string
  description?: string | null
  brand_id: string
  brand_name: string
  brand_slug: string
}): FinCatalogEsDoc {
  const modelName = row.name?.trim() ?? ""
  const brandName = row.brand_name?.trim() ?? ""
  const title = `${brandName} ${modelName}`.trim()
  return {
    kind: "model",
    entity_id: row.id,
    brand_id: row.brand_id,
    brand_name: brandName,
    brand_slug: row.brand_slug?.trim() ?? "",
    model_id: row.id,
    model_name: modelName,
    title,
    search_blob: [title, row.description?.trim() ?? ""].filter(Boolean).join(" "),
    name_compact: compactSearchKey(title),
    ...emptyLabels(),
  }
}

export function finCatalogVariantToEsDoc(row: {
  id: string
  brand_id: string
  brand_model_id: string
  brand_name: string
  brand_slug: string
  model_name: string
  fin_box_type?: string | null
  fin_boxes?: string | null
  fin_size?: string | null
  configuration_label?: string | null
  fin_base_label?: string | null
  fin_height_label?: string | null
  fin_foil_label?: string | null
  fin_color_label?: string | null
}): FinCatalogEsDoc {
  const brandName = row.brand_name?.trim() ?? ""
  const modelName = row.model_name?.trim() ?? ""
  const title = `${brandName} ${modelName}`.trim()
  const labels = [
    row.fin_box_type,
    row.fin_boxes,
    row.fin_size,
    row.configuration_label,
    row.fin_base_label,
    row.fin_height_label,
    row.fin_foil_label,
    row.fin_color_label,
  ]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)

  return {
    kind: "variant",
    entity_id: row.id,
    brand_id: row.brand_id,
    brand_name: brandName,
    brand_slug: row.brand_slug?.trim() ?? "",
    model_id: row.brand_model_id,
    model_name: modelName,
    title,
    search_blob: [title, ...labels].join(" "),
    name_compact: compactSearchKey(title),
    fin_box_type: row.fin_box_type?.trim() ?? "",
    fin_boxes: row.fin_boxes?.trim() ?? "",
    fin_size: row.fin_size?.trim() ?? "",
    configuration_label: row.configuration_label?.trim() ?? "",
    fin_base_label: row.fin_base_label?.trim() ?? "",
    fin_height_label: row.fin_height_label?.trim() ?? "",
    fin_foil_label: row.fin_foil_label?.trim() ?? "",
    fin_color_label: row.fin_color_label?.trim() ?? "",
  }
}

export async function ensureFinCatalogIndex(): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  try {
    const exists = await es.indices.exists({ index: ELASTICSEARCH_FIN_CATALOG_INDEX })
    if (!exists) {
      await es.indices.create({
        index: ELASTICSEARCH_FIN_CATALOG_INDEX,
        settings: INDEX_SETTINGS,
        mappings: INDEX_MAPPINGS,
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] ensureFinCatalogIndex failed:", msg, e)
  }
}

export async function indexFinCatalogDocument(doc: FinCatalogEsDoc): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  await ensureFinCatalogIndex()
  await es.index({
    index: ELASTICSEARCH_FIN_CATALOG_INDEX,
    id: finCatalogEsDocId(doc.kind, doc.entity_id),
    document: doc,
    refresh: false,
  })
}

export async function deleteFinCatalogDocument(
  kind: FinCatalogEsKind,
  entityId: string,
): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  try {
    await es.delete({
      index: ELASTICSEARCH_FIN_CATALOG_INDEX,
      id: finCatalogEsDocId(kind, entityId),
      refresh: false,
    })
  } catch (e: unknown) {
    const status = (e as { meta?: { statusCode?: number } })?.meta?.statusCode
    if (status === 404) return
    throw e
  }
}

export async function deleteFinCatalogDocsForBrand(brandId: string): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  try {
    await ensureFinCatalogIndex()
    await es.deleteByQuery({
      index: ELASTICSEARCH_FIN_CATALOG_INDEX,
      refresh: false,
      query: { term: { brand_id: brandId } },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] deleteFinCatalogDocsForBrand failed:", msg, e)
  }
}

/**
 * Relevance-ordered fin catalog hits for `/sell/fins`.
 * Supports compacted brand names (`trueames`), synonyms, and fuzzy title match.
 */
export async function searchFinCatalogHitsFromElasticsearch(
  rawQuery: string,
  options: {
    limit?: number
    finBrandIds?: readonly string[]
  } = {},
): Promise<FinCatalogEsHit[]> {
  const es = getElasticsearchClient()
  if (!es) return []

  const q = rawQuery.trim()
  if (!q) return []

  const limit = options.limit ?? 40
  const compact = compactSearchKey(q)
  const w = escapeElasticsearchWildcard(q.toLowerCase())
  const compactW = escapeElasticsearchWildcard(compact)

  try {
    await ensureFinCatalogIndex()

    const should: object[] = []

    if (compact.length >= 2) {
      should.push({ term: { name_compact: { value: compact, boost: 40 } } })
      should.push({ prefix: { name_compact: { value: compact, boost: 24 } } })
      if (compact.length >= 4) {
        should.push({
          wildcard: {
            name_compact: {
              value: `*${compactW}*`,
              case_insensitive: true,
              boost: 16,
            },
          },
        })
      }
    }

    should.push(
      q.length >= 4
        ? {
            multi_match: {
              query: q,
              fields: ["title^6", "brand_name^5", "model_name^4", "brand_slug^3", "search_blob^2"],
              type: "best_fields",
              operator: "or",
              fuzziness: "AUTO",
              tie_breaker: 0.2,
            },
          }
        : {
            multi_match: {
              query: q,
              fields: ["title^6", "brand_name^5", "model_name^4", "brand_slug^3", "search_blob^2"],
              type: "best_fields",
              operator: "or",
              tie_breaker: 0.2,
            },
          },
    )

    should.push({
      multi_match: {
        query: q,
        fields: ["title.edge^3", "brand_name.edge^2", "model_name.edge^2"],
        type: "bool_prefix",
        operator: "or",
      },
    })

    if (q.length >= 3) {
      should.push({
        wildcard: {
          "title.keyword": {
            value: q.length < 4 ? `${w}*` : `*${w}*`,
            case_insensitive: true,
            boost: 8,
          },
        },
      })
      should.push({
        wildcard: {
          "brand_name.keyword": {
            value: q.length < 4 ? `${w}*` : `*${w}*`,
            case_insensitive: true,
            boost: 10,
          },
        },
      })
    }

    const filter: object[] = []
    if (options.finBrandIds && options.finBrandIds.length > 0) {
      filter.push({ terms: { brand_id: [...options.finBrandIds] } })
    }

    const res = await es.search({
      index: ELASTICSEARCH_FIN_CATALOG_INDEX,
      size: limit,
      _source: ["kind", "entity_id"],
      query: {
        bool: {
          filter,
          should,
          minimum_should_match: 1,
        },
      },
      sort: [{ _score: { order: "desc" } }, { "title.keyword": { order: "asc" } }],
    })

    const hits: FinCatalogEsHit[] = []
    for (const hit of res.hits.hits ?? []) {
      const source = hit._source as { kind?: string; entity_id?: string } | undefined
      const kind = source?.kind
      const id = source?.entity_id
      if (kind !== "brand" && kind !== "model" && kind !== "variant") continue
      if (typeof id !== "string" || !id) continue
      hits.push({
        kind,
        id,
        score: typeof hit._score === "number" ? hit._score : 0,
      })
    }
    return hits
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] searchFinCatalogHitsFromElasticsearch failed:", msg, e)
    return []
  }
}

async function brandIsFinTagged(
  supabase: SupabaseClient,
  brandId: string,
): Promise<boolean> {
  const ids = await listBrandIdsMatchingProductCategories(supabase, [
    FIN_CATALOG_PRODUCT_CATEGORY,
  ])
  return Boolean(ids?.includes(brandId))
}

/** Sync or remove a brand (+ cascade delete when untagged; reindex models/variants when tagged). */
export async function syncFinCatalogBrandToIndex(
  supabase: SupabaseClient,
  brandId: string,
): Promise<void> {
  if (!getElasticsearchClient()) return

  const isFin = await brandIsFinTagged(supabase, brandId)
  if (!isFin) {
    await deleteFinCatalogDocsForBrand(brandId)
    return
  }

  const { data, error } = await supabase
    .from("brands")
    .select("id, name, slug, short_description")
    .eq("id", brandId)
    .maybeSingle()

  if (error || !data) {
    if (!error) await deleteFinCatalogDocsForBrand(brandId)
    return
  }

  await indexFinCatalogDocument(
    finCatalogBrandToEsDoc(data as Parameters<typeof finCatalogBrandToEsDoc>[0]),
  )

  const [{ data: modelRows }, { data: variantRows }] = await Promise.all([
    supabase.from("brand_models").select("id").eq("brand_id", brandId),
    supabase.from("brand_model_variants").select("id").eq("brand_id", brandId),
  ])

  for (const row of modelRows ?? []) {
    if (typeof row.id === "string") {
      await syncFinCatalogModelToIndex(supabase, row.id)
    }
  }
  for (const row of variantRows ?? []) {
    if (typeof row.id === "string") {
      await syncFinCatalogVariantToIndex(supabase, row.id)
    }
  }
}

export async function syncFinCatalogModelToIndex(
  supabase: SupabaseClient,
  modelId: string,
): Promise<void> {
  if (!getElasticsearchClient()) return

  const { data, error } = await supabase
    .from("brand_models")
    .select(
      `
      id,
      name,
      description,
      brand_id,
      product_category_slug,
      brands:brand_id ( id, name, slug )
    `,
    )
    .eq("id", modelId)
    .maybeSingle()

  if (error || !data) {
    if (!error) await deleteFinCatalogDocument("model", modelId)
    return
  }

  const brandJoined = data.brands as
    | { id: string; name: string; slug: string }
    | { id: string; name: string; slug: string }[]
    | null
  const brand = Array.isArray(brandJoined) ? brandJoined[0] ?? null : brandJoined
  if (!brand?.id) {
    await deleteFinCatalogDocument("model", modelId)
    return
  }

  const category = (data.product_category_slug as string | null) ?? null
  const isFinCategory =
    category === FIN_CATALOG_PRODUCT_CATEGORY || category === "surfboards" || !category
  const isFinBrand = await brandIsFinTagged(supabase, brand.id)

  if (!isFinBrand || !isFinCategory) {
    await deleteFinCatalogDocument("model", modelId)
    return
  }

  // Prefer explicit fins models; still index under fin-tagged brands for catalog completeness.
  if (category && category !== FIN_CATALOG_PRODUCT_CATEGORY && category !== "surfboards") {
    await deleteFinCatalogDocument("model", modelId)
    return
  }

  await indexFinCatalogDocument(
    finCatalogModelToEsDoc({
      id: data.id as string,
      name: data.name as string,
      description: data.description as string | null,
      brand_id: brand.id,
      brand_name: brand.name,
      brand_slug: brand.slug,
    }),
  )
}

export async function syncFinCatalogVariantToIndex(
  supabase: SupabaseClient,
  variantId: string,
): Promise<void> {
  if (!getElasticsearchClient()) return

  const { data, error } = await supabase
    .from("brand_model_variants")
    .select(
      `
      id,
      brand_id,
      brand_model_id,
      fin_box_type,
      fin_boxes,
      fin_size,
      configuration_label,
      fin_base_label,
      fin_height_label,
      fin_foil_label,
      fin_color_label,
      product_category_slug,
      brand_models:brand_model_id (
        id,
        name,
        product_category_slug,
        brands:brand_id ( id, name, slug )
      )
    `,
    )
    .eq("id", variantId)
    .maybeSingle()

  if (error || !data) {
    if (!error) await deleteFinCatalogDocument("variant", variantId)
    return
  }

  const category = (data.product_category_slug as string | null) ?? ""
  if (category !== FIN_CATALOG_PRODUCT_CATEGORY && category !== "surfboards") {
    await deleteFinCatalogDocument("variant", variantId)
    return
  }

  const modelJoined = data.brand_models as
    | {
        id: string
        name: string
        product_category_slug?: string
        brands:
          | { id: string; name: string; slug: string }
          | { id: string; name: string; slug: string }[]
          | null
      }
    | {
        id: string
        name: string
        product_category_slug?: string
        brands:
          | { id: string; name: string; slug: string }
          | { id: string; name: string; slug: string }[]
          | null
      }[]
    | null
  const model = Array.isArray(modelJoined) ? modelJoined[0] ?? null : modelJoined
  const brandJoined = model?.brands ?? null
  const brand = Array.isArray(brandJoined) ? brandJoined[0] ?? null : brandJoined
  if (!model?.id || !brand?.id) {
    await deleteFinCatalogDocument("variant", variantId)
    return
  }

  const isFinBrand = await brandIsFinTagged(supabase, brand.id)
  if (!isFinBrand) {
    await deleteFinCatalogDocument("variant", variantId)
    return
  }

  await indexFinCatalogDocument(
    finCatalogVariantToEsDoc({
      id: data.id as string,
      brand_id: brand.id,
      brand_model_id: model.id,
      brand_name: brand.name,
      brand_slug: brand.slug,
      model_name: model.name,
      fin_box_type: data.fin_box_type as string | null,
      fin_boxes: data.fin_boxes as string | null,
      fin_size: data.fin_size as string | null,
      configuration_label: data.configuration_label as string | null,
      fin_base_label: data.fin_base_label as string | null,
      fin_height_label: data.fin_height_label as string | null,
      fin_foil_label: data.fin_foil_label as string | null,
      fin_color_label: data.fin_color_label as string | null,
    }),
  )
}

export type ReindexFinCatalogResult = {
  brandsIndexed: number
  modelsIndexed: number
  variantsIndexed: number
  errors: number
}

/** Full rebuild of the fin catalog index from Supabase (fin-tagged brands only). */
export async function reindexFinCatalogFromSupabase(
  supabase: SupabaseClient,
): Promise<ReindexFinCatalogResult> {
  const result: ReindexFinCatalogResult = {
    brandsIndexed: 0,
    modelsIndexed: 0,
    variantsIndexed: 0,
    errors: 0,
  }

  if (!getElasticsearchClient()) return result

  await ensureFinCatalogIndex()

  const finBrandIds = await listBrandIdsMatchingProductCategories(supabase, [
    FIN_CATALOG_PRODUCT_CATEGORY,
  ])
  if (!finBrandIds?.length) return result

  const pageSize = 200

  // Brands
  for (let from = 0; ; from += pageSize) {
    const { data: rows, error } = await supabase
      .from("brands")
      .select("id, name, slug, short_description")
      .in("id", finBrandIds)
      .order("name", { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error("[elasticsearch] reindexFinCatalog brands:", error.message)
      result.errors++
      break
    }
    if (!rows?.length) break

    for (const row of rows) {
      try {
        await indexFinCatalogDocument(finCatalogBrandToEsDoc(row))
        result.brandsIndexed++
      } catch {
        result.errors++
      }
    }
    if (rows.length < pageSize) break
  }

  // Models under fin brands
  for (let from = 0; ; from += pageSize) {
    const { data: rows, error } = await supabase
      .from("brand_models")
      .select(
        `
        id,
        name,
        description,
        brand_id,
        product_category_slug,
        brands:brand_id ( id, name, slug )
      `,
      )
      .in("brand_id", finBrandIds)
      .order("name", { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error("[elasticsearch] reindexFinCatalog models:", error.message)
      result.errors++
      break
    }
    if (!rows?.length) break

    for (const row of rows) {
      try {
        const category = (row.product_category_slug as string | null) ?? null
        if (
          category &&
          category !== FIN_CATALOG_PRODUCT_CATEGORY &&
          category !== "surfboards"
        ) {
          continue
        }
        const brandJoined = row.brands as
          | { id: string; name: string; slug: string }
          | { id: string; name: string; slug: string }[]
          | null
        const brand = Array.isArray(brandJoined) ? brandJoined[0] ?? null : brandJoined
        if (!brand?.id) continue
        await indexFinCatalogDocument(
          finCatalogModelToEsDoc({
            id: row.id as string,
            name: row.name as string,
            description: row.description as string | null,
            brand_id: brand.id,
            brand_name: brand.name,
            brand_slug: brand.slug,
          }),
        )
        result.modelsIndexed++
      } catch {
        result.errors++
      }
    }
    if (rows.length < pageSize) break
  }

  // Variants (fins category, fin brands)
  for (let from = 0; ; from += pageSize) {
    const { data: rows, error } = await supabase
      .from("brand_model_variants")
      .select(
        `
        id,
        brand_id,
        brand_model_id,
        fin_box_type,
        fin_boxes,
        fin_size,
        configuration_label,
        fin_base_label,
        fin_height_label,
        fin_foil_label,
        fin_color_label,
        product_category_slug,
        brand_models:brand_model_id (
          id,
          name,
          brands:brand_id ( id, name, slug )
        )
      `,
      )
      .in("brand_id", finBrandIds)
      .in("product_category_slug", [FIN_CATALOG_PRODUCT_CATEGORY, "surfboards"])
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error("[elasticsearch] reindexFinCatalog variants:", error.message)
      result.errors++
      break
    }
    if (!rows?.length) break

    for (const row of rows) {
      try {
        const modelJoined = row.brand_models as
          | {
              id: string
              name: string
              brands:
                | { id: string; name: string; slug: string }
                | { id: string; name: string; slug: string }[]
                | null
            }
          | {
              id: string
              name: string
              brands:
                | { id: string; name: string; slug: string }
                | { id: string; name: string; slug: string }[]
                | null
            }[]
          | null
        const model = Array.isArray(modelJoined) ? modelJoined[0] ?? null : modelJoined
        const brandJoined = model?.brands ?? null
        const brand = Array.isArray(brandJoined) ? brandJoined[0] ?? null : brandJoined
        if (!model?.id || !brand?.id) continue

        await indexFinCatalogDocument(
          finCatalogVariantToEsDoc({
            id: row.id as string,
            brand_id: brand.id,
            brand_model_id: model.id,
            brand_name: brand.name,
            brand_slug: brand.slug,
            model_name: model.name,
            fin_box_type: row.fin_box_type as string | null,
            fin_boxes: row.fin_boxes as string | null,
            fin_size: row.fin_size as string | null,
            configuration_label: row.configuration_label as string | null,
            fin_base_label: row.fin_base_label as string | null,
            fin_height_label: row.fin_height_label as string | null,
            fin_foil_label: row.fin_foil_label as string | null,
            fin_color_label: row.fin_color_label as string | null,
          }),
        )
        result.variantsIndexed++
      } catch {
        result.errors++
      }
    }
    if (rows.length < pageSize) break
  }

  return result
}
