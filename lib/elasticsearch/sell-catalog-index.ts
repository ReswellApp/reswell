import type { SupabaseClient } from "@supabase/supabase-js"
import type { BrandProductCategorySlug } from "@/lib/brand-product-categories"
import {
  listBrandProductCategoriesByBrandIds,
  listBrandIdsMatchingProductCategories,
} from "@/lib/db/brand-product-categories"
import {
  SELL_CATALOG_SEARCH_CATEGORIES,
  isSellCatalogSearchCategory,
  type SellCatalogSearchCategory,
} from "@/lib/types/sell-catalog-search"
import { compactSearchKey } from "@/lib/utils/fin-catalog-search-rank"
import { sellCatalogEmbeddingText } from "@/lib/elasticsearch/sell-catalog-embedding-text"
import {
  CATALOG_EMBED_DIMENSIONS,
  embedCatalogDocuments,
  isCatalogEmbedConfigured,
} from "@/lib/services/catalogEmbed"
import { getElasticsearchClient } from "./client"
import { ELASTICSEARCH_SELL_CATALOG_INDEX } from "./config"

export type SellCatalogEsKind = "brand" | "model"

/**
 * Brand + model documents across every `/sell` catalog category
 * (surfboards, fins, wetsuits, apparel). Used strictly by the `/sell`
 * "Find a match" wall to resolve brand/model text into catalog rows —
 * fins additionally keep their richer variant-level index.
 */
export type SellCatalogEsDoc = {
  kind: SellCatalogEsKind
  entity_id: string
  brand_id: string
  brand_name: string
  brand_slug: string
  model_id: string
  model_name: string
  title: string
  search_blob: string
  name_compact: string
  /** Brand docs: every sell category the brand is tagged with. Model docs: single category. */
  categories: SellCatalogSearchCategory[]
  /** Gemini Embedding 2 retrieval vector. Absent until the row is embedded. */
  embedding?: number[]
}

export type SellCatalogEsHit = {
  kind: SellCatalogEsKind
  id: string
  score: number
}

const INDEX_SETTINGS = {
  analysis: {
    filter: {
      catalog_synonyms: {
        type: "synonym" as const,
        synonyms: [
          "ta, trueames => true, ames",
          "ci => channel, islands",
          "lost, mayhem",
          "pv => pacific, vibrations",
          "fcs2, fcsii => fcs",
          "tri => thruster",
        ],
      },
      catalog_edge_ngram: {
        type: "edge_ngram" as const,
        min_gram: 2,
        max_gram: 20,
      },
    },
    analyzer: {
      catalog_text: {
        type: "custom" as const,
        tokenizer: "standard",
        filter: ["lowercase", "asciifolding", "catalog_synonyms"],
      },
      catalog_edge: {
        type: "custom" as const,
        tokenizer: "standard",
        filter: ["lowercase", "asciifolding", "catalog_edge_ngram"],
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
  analyzer: "catalog_text",
  fields: {
    edge: { type: "text" as const, analyzer: "catalog_edge", search_analyzer: "catalog_text" },
    keyword: { type: "keyword" as const, normalizer: "lowercase" },
  },
}

const EMBEDDING_PROPERTY = {
  type: "dense_vector" as const,
  dims: CATALOG_EMBED_DIMENSIONS,
  index: true,
  similarity: "cosine" as const,
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
    search_blob: { type: "text" as const, analyzer: "catalog_text" },
    name_compact: { type: "keyword" as const, normalizer: "lowercase" },
    categories: { type: "keyword" as const },
    embedding: EMBEDDING_PROPERTY,
  },
}

export function sellCatalogEsDocId(kind: SellCatalogEsKind, entityId: string): string {
  return `${kind}:${entityId}`
}

function escapeElasticsearchWildcard(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/[*?]/g, "\\$&")
}

function sellCategoriesOf(
  slugs: readonly BrandProductCategorySlug[] | undefined,
): SellCatalogSearchCategory[] {
  return (slugs ?? []).filter(isSellCatalogSearchCategory)
}

export function sellCatalogBrandToEsDoc(row: {
  id: string
  name: string
  slug: string
  short_description?: string | null
  categories: readonly SellCatalogSearchCategory[]
}): SellCatalogEsDoc {
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
    categories: [...row.categories],
  }
}

export function sellCatalogModelToEsDoc(row: {
  id: string
  name: string
  description?: string | null
  category: SellCatalogSearchCategory
  brand_id: string
  brand_name: string
  brand_slug: string
}): SellCatalogEsDoc {
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
    categories: [row.category],
  }
}

let sellCatalogIndexReady = false

export async function ensureSellCatalogIndex(): Promise<void> {
  if (sellCatalogIndexReady) return
  const es = getElasticsearchClient()
  if (!es) return

  try {
    const exists = await es.indices.exists({ index: ELASTICSEARCH_SELL_CATALOG_INDEX })
    if (!exists) {
      await es.indices.create({
        index: ELASTICSEARCH_SELL_CATALOG_INDEX,
        settings: INDEX_SETTINGS,
        mappings: INDEX_MAPPINGS,
      })
    } else {
      await es.indices.putMapping({
        index: ELASTICSEARCH_SELL_CATALOG_INDEX,
        properties: { embedding: EMBEDDING_PROPERTY },
      })
    }
    sellCatalogIndexReady = true
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] ensureSellCatalogIndex failed:", msg, e)
  }
}

function catalogDocumentBody(doc: SellCatalogEsDoc): SellCatalogEsDoc {
  if (!doc.embedding) {
    const { embedding: _embedding, ...rest } = doc
    return rest
  }
  return doc
}

export async function indexSellCatalogDocument(doc: SellCatalogEsDoc): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  await ensureSellCatalogIndex()
  await es.index({
    index: ELASTICSEARCH_SELL_CATALOG_INDEX,
    id: sellCatalogEsDocId(doc.kind, doc.entity_id),
    document: catalogDocumentBody(doc),
    refresh: false,
  })
}

/**
 * Attach Gemini Embedding 2 document vectors, then index.
 * A Cohere failure still indexes the text so lexical search keeps working.
 */
export async function indexSellCatalogDocuments(
  docs: readonly SellCatalogEsDoc[],
): Promise<{ indexed: number; errors: number }> {
  if (docs.length === 0) return { indexed: 0, errors: 0 }

  let prepared = [...docs]
  if (isCatalogEmbedConfigured()) {
    try {
      const vectors = await embedCatalogDocuments(prepared.map((doc) => sellCatalogEmbeddingText(doc)))
      prepared = prepared.map((doc, index) => {
        const embedding = vectors[index]
        return embedding ? { ...doc, embedding } : doc
      })
    } catch (err) {
      console.error(
        "[elasticsearch] sell catalog embed failed:",
        err instanceof Error ? err.message : err,
      )
    }
  }

  let indexed = 0
  let errors = 0
  for (const doc of prepared) {
    try {
      await indexSellCatalogDocument(doc)
      indexed++
    } catch (err) {
      errors++
      console.error(
        "[elasticsearch] indexSellCatalogDocument failed:",
        err instanceof Error ? err.message : err,
      )
    }
  }
  return { indexed, errors }
}

export async function deleteSellCatalogDocument(
  kind: SellCatalogEsKind,
  entityId: string,
): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  try {
    await es.delete({
      index: ELASTICSEARCH_SELL_CATALOG_INDEX,
      id: sellCatalogEsDocId(kind, entityId),
      refresh: false,
    })
  } catch (e: unknown) {
    const status = (e as { meta?: { statusCode?: number } })?.meta?.statusCode
    if (status === 404) return
    throw e
  }
}

export async function deleteSellCatalogDocsForBrand(brandId: string): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  try {
    await ensureSellCatalogIndex()
    await es.deleteByQuery({
      index: ELASTICSEARCH_SELL_CATALOG_INDEX,
      refresh: false,
      query: { term: { brand_id: brandId } },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] deleteSellCatalogDocsForBrand failed:", msg, e)
  }
}

/**
 * Relevance-ordered brand/model hits for the `/sell` catalog search wall.
 * Supports compacted names (`gatoheroi`), synonyms, edge-prefix, and fuzzy match.
 */
export async function searchSellCatalogHitsFromElasticsearch(
  rawQuery: string,
  options: {
    limit?: number
    categories?: readonly SellCatalogSearchCategory[]
  } = {},
): Promise<SellCatalogEsHit[]> {
  const es = getElasticsearchClient()
  if (!es) return []

  const q = rawQuery.trim()
  if (!q) return []

  const limit = options.limit ?? 40
  const compact = compactSearchKey(q)
  const w = escapeElasticsearchWildcard(q.toLowerCase())
  const compactW = escapeElasticsearchWildcard(compact)

  try {
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

    // Multi-token brand+model queries ("gato heroi dagger") should reward docs
    // matching every token across the combined title.
    if (/\s/.test(q)) {
      should.push({
        match: {
          title: {
            query: q,
            operator: "and",
            boost: 20,
          },
        },
      })
      if (q.length >= 6) {
        should.push({
          match: {
            title: {
              query: q,
              operator: "and",
              fuzziness: "AUTO",
              boost: 12,
            },
          },
        })
      }
    }

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
    if (options.categories && options.categories.length > 0) {
      filter.push({ terms: { categories: [...options.categories] } })
    }

    const res = await es.search({
      index: ELASTICSEARCH_SELL_CATALOG_INDEX,
      size: limit,
      _source: ["kind", "entity_id"],
      track_total_hits: false,
      query: {
        bool: {
          filter,
          should,
          minimum_should_match: 1,
        },
      },
      sort: [{ _score: { order: "desc" } }, { "title.keyword": { order: "asc" } }],
    })

    const hits: SellCatalogEsHit[] = []
    for (const hit of res.hits.hits ?? []) {
      const source = hit._source as { kind?: string; entity_id?: string } | undefined
      const kind = source?.kind
      const id = source?.entity_id
      if (kind !== "brand" && kind !== "model") continue
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
    console.error("[elasticsearch] searchSellCatalogHitsFromElasticsearch failed:", msg, e)
    return []
  }
}

/**
 * Nearest catalog rows for a Gemini Embedding 2 retrieval-query vector.
 * Documents without an embedding are skipped by Elasticsearch.
 */
export async function searchSellCatalogByEmbedding(
  vector: readonly number[],
  options: {
    limit?: number
    categories?: readonly SellCatalogSearchCategory[]
  } = {},
): Promise<SellCatalogEsHit[]> {
  const es = getElasticsearchClient()
  if (!es || vector.length !== CATALOG_EMBED_DIMENSIONS) return []

  const limit = options.limit ?? 12
  const filter =
    options.categories && options.categories.length > 0
      ? { terms: { categories: [...options.categories] } }
      : undefined

  try {
    const res = await es.search({
      index: ELASTICSEARCH_SELL_CATALOG_INDEX,
      size: limit,
      _source: ["kind", "entity_id"],
      track_total_hits: false,
      knn: {
        field: "embedding",
        query_vector: [...vector],
        k: limit,
        num_candidates: Math.max(limit * 8, 48),
        ...(filter ? { filter } : {}),
      },
    })

    const hits: SellCatalogEsHit[] = []
    for (const hit of res.hits.hits ?? []) {
      const source = hit._source as { kind?: string; entity_id?: string } | undefined
      const kind = source?.kind
      const id = source?.entity_id
      if (kind !== "brand" && kind !== "model") continue
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
    console.error("[elasticsearch] searchSellCatalogByEmbedding failed:", msg, e)
    return []
  }
}

async function brandSellCategories(
  supabase: SupabaseClient,
  brandId: string,
): Promise<SellCatalogSearchCategory[]> {
  const map = await listBrandProductCategoriesByBrandIds(supabase, [brandId])
  return sellCategoriesOf(map.get(brandId))
}

/** Sync or remove a brand (+ cascade delete when untagged; reindex models when tagged). */
export async function syncSellCatalogBrandToIndex(
  supabase: SupabaseClient,
  brandId: string,
): Promise<void> {
  if (!getElasticsearchClient()) return

  const categories = await brandSellCategories(supabase, brandId)
  if (categories.length === 0) {
    await deleteSellCatalogDocsForBrand(brandId)
    return
  }

  const { data, error } = await supabase
    .from("brands")
    .select("id, name, slug, short_description")
    .eq("id", brandId)
    .maybeSingle()

  if (error || !data) {
    if (!error) await deleteSellCatalogDocsForBrand(brandId)
    return
  }

  await indexSellCatalogDocuments([
    sellCatalogBrandToEsDoc({
      id: data.id as string,
      name: data.name as string,
      slug: data.slug as string,
      short_description: data.short_description as string | null,
      categories,
    }),
  ])

  const { data: modelRows } = await supabase
    .from("brand_models")
    .select("id")
    .eq("brand_id", brandId)

  for (const row of modelRows ?? []) {
    if (typeof row.id === "string") {
      await syncSellCatalogModelToIndex(supabase, row.id)
    }
  }
}

export async function syncSellCatalogModelToIndex(
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
    if (!error) await deleteSellCatalogDocument("model", modelId)
    return
  }

  const category = (data.product_category_slug as string | null) ?? ""
  if (!isSellCatalogSearchCategory(category)) {
    await deleteSellCatalogDocument("model", modelId)
    return
  }

  const brandJoined = data.brands as
    | { id: string; name: string; slug: string }
    | { id: string; name: string; slug: string }[]
    | null
  const brand = Array.isArray(brandJoined) ? brandJoined[0] ?? null : brandJoined
  if (!brand?.id) {
    await deleteSellCatalogDocument("model", modelId)
    return
  }

  await indexSellCatalogDocuments([
    sellCatalogModelToEsDoc({
      id: data.id as string,
      name: data.name as string,
      description: data.description as string | null,
      category,
      brand_id: brand.id,
      brand_name: brand.name,
      brand_slug: brand.slug,
    }),
  ])
}

export type ReindexSellCatalogResult = {
  brandsIndexed: number
  modelsIndexed: number
  errors: number
}

/** Full rebuild of the sell catalog index from Supabase (all sell categories). */
export async function reindexSellCatalogFromSupabase(
  supabase: SupabaseClient,
): Promise<ReindexSellCatalogResult> {
  const result: ReindexSellCatalogResult = {
    brandsIndexed: 0,
    modelsIndexed: 0,
    errors: 0,
  }

  if (!getElasticsearchClient()) return result

  await ensureSellCatalogIndex()

  const sellBrandIds = await listBrandIdsMatchingProductCategories(supabase, [
    ...SELL_CATALOG_SEARCH_CATEGORIES,
  ])
  if (!sellBrandIds?.length) return result

  const pageSize = 200

  // Brands tagged with at least one sell category
  for (let from = 0; ; from += pageSize) {
    const { data: rows, error } = await supabase
      .from("brands")
      .select("id, name, slug, short_description")
      .in("id", sellBrandIds)
      .order("name", { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error("[elasticsearch] reindexSellCatalog brands:", error.message)
      result.errors++
      break
    }
    if (!rows?.length) break

    const categoryMap = await listBrandProductCategoriesByBrandIds(
      supabase,
      rows.map((r) => r.id as string),
    )

    const docs: SellCatalogEsDoc[] = []
    for (const row of rows) {
      const categories = sellCategoriesOf(categoryMap.get(row.id as string))
      if (categories.length === 0) continue
      docs.push(
        sellCatalogBrandToEsDoc({
          id: row.id as string,
          name: row.name as string,
          slug: row.slug as string,
          short_description: row.short_description as string | null,
          categories,
        }),
      )
    }
    const written = await indexSellCatalogDocuments(docs)
    result.brandsIndexed += written.indexed
    result.errors += written.errors
    if (rows.length < pageSize) break
  }

  // Models in any sell category
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
      .in("product_category_slug", [...SELL_CATALOG_SEARCH_CATEGORIES])
      .order("name", { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error("[elasticsearch] reindexSellCatalog models:", error.message)
      result.errors++
      break
    }
    if (!rows?.length) break

    const docs: SellCatalogEsDoc[] = []
    for (const row of rows) {
      const category = (row.product_category_slug as string | null) ?? ""
      if (!isSellCatalogSearchCategory(category)) continue
      const brandJoined = row.brands as
        | { id: string; name: string; slug: string }
        | { id: string; name: string; slug: string }[]
        | null
      const brand = Array.isArray(brandJoined) ? brandJoined[0] ?? null : brandJoined
      if (!brand?.id) continue
      docs.push(
        sellCatalogModelToEsDoc({
          id: row.id as string,
          name: row.name as string,
          description: row.description as string | null,
          category,
          brand_id: brand.id,
          brand_name: brand.name,
          brand_slug: brand.slug,
        }),
      )
    }
    const written = await indexSellCatalogDocuments(docs)
    result.modelsIndexed += written.indexed
    result.errors += written.errors
    if (rows.length < pageSize) break
  }

  return result
}
