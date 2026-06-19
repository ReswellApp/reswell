import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { brandRowToSearchDoc, ensureBrandsIndex, indexBrandDocument } from "@/lib/elasticsearch/brands-index"
import {
  ensureListingsIndex,
  indexListingDocument,
  listingRowToSearchDocFromRow,
} from "@/lib/elasticsearch/listings-index"
import {
  deleteSellerDocument,
  ensureSellersIndex,
  indexSellerDocument,
  profileRowToSellerDoc,
  type SellerProfileRow,
} from "@/lib/elasticsearch/sellers-index"
import { getElasticsearchClient } from "@/lib/elasticsearch/client"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import { ELASTICSEARCH_INDEXED_LISTING_SECTIONS } from "@/lib/elasticsearch/listing-sections"

/**
 * Full reindex of active indexed peer listings (surfboards + fins) into Elasticsearch.
 * POST /api/search/reindex
 *
 * Auth: either
 * - Authorization: Bearer <SEARCH_REINDEX_SECRET> (for CI/scripts)
 * - Valid admin session (cookie) — no secret needed; use admin UI
 */
export async function POST(request: NextRequest) {
  let authorized = false

  const secret = process.env.SEARCH_REINDEX_SECRET
  const auth = request.headers.get("authorization") || ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
  if (secret && token === secret) {
    authorized = true
  }

  if (!authorized) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single()
      if (profile?.is_admin) authorized = true
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isElasticsearchConfigured()) {
    return NextResponse.json(
      {
        error:
          "Elasticsearch is not configured. Set ELASTICSEARCH_URL plus ELASTICSEARCH_API_KEY (or username/password), or ELASTICSEARCH_ALLOW_ANONYMOUS=true for a local unsecured cluster.",
      },
      { status: 503 },
    )
  }

  const es = getElasticsearchClient()
  if (!es) {
    return NextResponse.json({ error: "Elasticsearch client unavailable" }, { status: 503 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY is not set. Add it in Vercel (Production) or .env.local (local). Get it from Supabase → Settings → API.",
      },
      { status: 503 },
    )
  }

  try {
    await ensureListingsIndex()
    await ensureBrandsIndex()
    await ensureSellersIndex()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Elasticsearch index setup failed: ${msg}` },
      { status: 503 },
    )
  }

  const supabase = createServiceRoleClient()
  const pageSize = 200
  let from = 0
  let indexed = 0
  let errors = 0
  let brandsIndexed = 0
  let brandErrors = 0
  let brandFrom = 0
  let sellersIndexed = 0
  let sellersRemoved = 0
  let sellerErrors = 0
  let sellerFrom = 0

  for (;;) {
    const { data: rows, error } = await supabase
      .from("listings")
      .select(
        `
        id,
        title,
        description,
        section,
        status,
        board_type,
        brand,
        model,
        city,
        state,
        created_at,
        categories (name)
      `,
      )
      .eq("status", "active")
      .in("section", [...ELASTICSEARCH_INDEXED_LISTING_SECTIONS])
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!rows?.length) break

    for (const row of rows as any[]) {
      try {
        const doc = listingRowToSearchDocFromRow(row)
        await indexListingDocument(doc)
        indexed++
      } catch {
        errors++
      }
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  for (;;) {
    const { data: brandRows, error: brandListError } = await supabase
      .from("brands")
      .select("id, name, slug, short_description, lead_shaper_name, location_label, founder_name")
      .order("name", { ascending: true })
      .range(brandFrom, brandFrom + pageSize - 1)

    if (brandListError) {
      return NextResponse.json({ error: brandListError.message }, { status: 500 })
    }

    if (!brandRows?.length) break

    for (const row of brandRows) {
      try {
        const doc = brandRowToSearchDoc(row as Parameters<typeof brandRowToSearchDoc>[0])
        await indexBrandDocument(doc)
        brandsIndexed++
      } catch {
        brandErrors++
      }
    }

    if (brandRows.length < pageSize) break
    brandFrom += pageSize
  }

  // Collect user_ids with at least one active, visible listing so we can set
  // `has_active_listings` per profile without an N+1 query.
  const activeListingUserIds = new Set<string>()
  {
    const activeListingPageSize = 1000
    let activeListingFrom = 0
    for (;;) {
      const { data: rows, error } = await supabase
        .from("listings")
        .select("user_id")
        .eq("status", "active")
        .eq("hidden_from_site", false)
        .is("archived_at", null)
        .range(activeListingFrom, activeListingFrom + activeListingPageSize - 1)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      if (!rows?.length) break

      for (const row of rows) {
        const uid = (row as { user_id?: string }).user_id
        if (uid) activeListingUserIds.add(uid)
      }
      if (rows.length < activeListingPageSize) break
      activeListingFrom += activeListingPageSize
    }
  }

  for (;;) {
    const { data: sellerRows, error: sellerListError } = await supabase
      .from("profiles")
      .select(
        "id, seller_slug, display_name, shop_name, shop_description, bio, city, shop_address, is_shop, shop_verified",
      )
      .order("id", { ascending: true })
      .range(sellerFrom, sellerFrom + pageSize - 1)

    if (sellerListError) {
      return NextResponse.json({ error: sellerListError.message }, { status: 500 })
    }
    if (!sellerRows?.length) break

    for (const row of sellerRows as SellerProfileRow[]) {
      try {
        const hasListings = activeListingUserIds.has(row.id)
        const eligible = Boolean(row.is_shop) || hasListings
        if (!eligible || !row.seller_slug) {
          await deleteSellerDocument(row.id)
          sellersRemoved++
          continue
        }
        await indexSellerDocument(profileRowToSellerDoc(row, hasListings))
        sellersIndexed++
      } catch {
        sellerErrors++
      }
    }

    if (sellerRows.length < pageSize) break
    sellerFrom += pageSize
  }

  return NextResponse.json({
    ok: true,
    indexed,
    errors,
    brandsIndexed,
    brandErrors,
    sellersIndexed,
    sellersRemoved,
    sellerErrors,
  })
}
