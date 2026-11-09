import type { SupabaseClient } from "@supabase/supabase-js"
import { dbSaveShopifyMapping } from "@/lib/db/shopifyCatalog"
import {
  shopifyGraphqlRequest,
  throwOnShopifyUserErrors,
} from "@/lib/shopify/admin-graphql"
import { isPeerListingSection, type PeerListingSection } from "@/lib/peer-listing-sections"
import type { ShopifyConnectionRow } from "@/lib/shopify/types"
import { getShopifyAccessToken } from "@/lib/services/shopifyOAuth"

export interface ReswellPublishCandidate {
  id: string
  title: string
  price: number
  section: PeerListingSection
  imageUrl: string | null
  published: boolean
}

function descriptionHtml(value: string | null): string {
  const text = value?.trim() ?? ""
  if (!text) return "<p></p>"
  if (text.includes("<")) return text
  return `<p>${text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</p>`
}

async function primaryLocationId(
  shopDomain: string,
  accessToken: string,
): Promise<string> {
  const data = await shopifyGraphqlRequest<{
    locations: { nodes: Array<{ id?: string | null; isActive?: boolean | null }> }
  }>({
    shopDomain,
    accessToken,
    query: `
      query ReswellPublishLocation {
        locations(first: 5) { nodes { id isActive } }
      }
    `,
  })
  const location = data.locations.nodes.find((node) => node.isActive !== false && node.id)
  if (!location?.id) throw new Error("Shopify shop has no active location")
  return location.id
}

export async function listReswellListingsToPublish(input: {
  serviceSupabase: SupabaseClient
  connection: ShopifyConnectionRow
}): Promise<ReswellPublishCandidate[]> {
  const { data, error } = await input.serviceSupabase
    .from("listings")
    .select("id, title, price, section, stock_quantity")
    .eq("user_id", input.connection.user_id)
    .eq("status", "active")
    .eq("inventory_source", "reswell")
    .order("updated_at", { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  const listings = (data ?? []).filter((row) => isPeerListingSection(String(row.section)))
  const ids = listings.map((row) => String(row.id))
  if (ids.length === 0) return []
  const [{ data: mappings, error: mappingError }, { data: images, error: imageError }] =
    await Promise.all([
      input.serviceSupabase
        .from("shopify_product_mappings")
        .select("listing_id")
        .eq("connection_id", input.connection.id)
        .eq("selected", true)
        .in("listing_id", ids),
      input.serviceSupabase
        .from("listing_images")
        .select("listing_id, url, is_primary, sort_order")
        .in("listing_id", ids)
        .order("sort_order", { ascending: true }),
    ])
  if (mappingError) throw new Error(mappingError.message)
  if (imageError) throw new Error(imageError.message)
  const published = new Set((mappings ?? []).map((row) => String(row.listing_id)))
  const imageByListing = new Map<string, string>()
  for (const image of images ?? []) {
    const listingId = String(image.listing_id)
    const url = typeof image.url === "string" ? image.url : ""
    if (!url.startsWith("https://")) continue
    if (!imageByListing.has(listingId) || image.is_primary === true) {
      imageByListing.set(listingId, url)
    }
  }
  return listings.map((row) => ({
    id: String(row.id),
    title: String(row.title ?? "Listing"),
    price: Number(row.price) || 0,
    section: row.section as PeerListingSection,
    imageUrl: imageByListing.get(String(row.id)) ?? null,
    published: published.has(String(row.id)),
  }))
}

export async function publishReswellListingToShopify(input: {
  serviceSupabase: SupabaseClient
  connection: ShopifyConnectionRow
  listingId: string
}): Promise<void> {
  const { data: listing, error } = await input.serviceSupabase
    .from("listings")
    .select("id, user_id, title, description, price, brand, section, status, stock_quantity, inventory_source")
    .eq("id", input.listingId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!listing || listing.user_id !== input.connection.user_id) {
    throw new Error("Listing not found")
  }
  if (listing.status !== "active" || listing.inventory_source !== "reswell") {
    throw new Error("Only active Reswell listings can publish to Shopify")
  }
  if (!isPeerListingSection(String(listing.section))) {
    throw new Error("This listing cannot publish to Shopify")
  }
  const { data: existing, error: existingError } = await input.serviceSupabase
    .from("shopify_product_mappings")
    .select("id")
    .eq("listing_id", input.listingId)
    .eq("selected", true)
    .maybeSingle()
  if (existingError) throw new Error(existingError.message)
  if (existing) return

  const accessToken = await getShopifyAccessToken(
    input.serviceSupabase,
    input.connection,
  )
  const locationId = await primaryLocationId(input.connection.shop_domain, accessToken)
  const quantity = Math.max(0, Math.floor(Number(listing.stock_quantity) || 1))
  const price = (Number(listing.price) || 0).toFixed(2)
  const { data: image } = await input.serviceSupabase
    .from("listing_images")
    .select("url")
    .eq("listing_id", input.listingId)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle()
  const imageUrl = typeof image?.url === "string" && image.url.startsWith("https://")
    ? image.url
    : null

  const productInput: Record<string, unknown> = {
    title: String(listing.title ?? "Reswell listing").slice(0, 255),
    descriptionHtml: descriptionHtml(
      typeof listing.description === "string" ? listing.description : null,
    ),
    vendor: typeof listing.brand === "string" ? listing.brand.slice(0, 255) : undefined,
    status: "ACTIVE",
    productOptions: [{ name: "Title", values: [{ name: "Default Title" }] }],
    variants: [
      {
        optionValues: [{ optionName: "Title", name: "Default Title" }],
        price,
        inventoryItem: { tracked: true },
        inventoryQuantities: [
          { locationId, name: "available", quantity },
        ],
      },
    ],
  }
  if (imageUrl) {
    productInput.files = [{ originalSource: imageUrl, contentType: "IMAGE" }]
  }

  const created = await shopifyGraphqlRequest<{
    productSet: {
      product?: {
        id?: string | null
        variants?: {
          nodes: Array<{
            id?: string | null
            inventoryItem?: { id?: string | null } | null
          }>
        } | null
      } | null
      userErrors: Array<{ field?: string[] | null; message?: string | null }>
    }
  }>({
    shopDomain: input.connection.shop_domain,
    accessToken,
    idempotencyKey: `reswell-listing-${input.listingId}`,
    query: `
      mutation ReswellPublishListing($input: ProductSetInput!) {
        productSet(synchronous: true, input: $input) {
          product {
            id
            variants(first: 1) {
              nodes { id inventoryItem { id } }
            }
          }
          userErrors { field message }
        }
      }
    `,
    variables: { input: productInput },
  })
  throwOnShopifyUserErrors(created.productSet.userErrors)
  const productId = created.productSet.product?.id
  const variant = created.productSet.product?.variants?.nodes[0]
  const variantId = variant?.id
  const inventoryItemId = variant?.inventoryItem?.id
  if (!productId || !variantId || !inventoryItemId) {
    throw new Error("Shopify did not return the published product")
  }
  const saved = await dbSaveShopifyMapping(input.serviceSupabase, {
    mappingId: null,
    connectionId: input.connection.id,
    listingId: input.listingId,
    productId,
    variantId,
    inventoryItemId,
    section: listing.section as PeerListingSection,
    status: "synced",
    remoteUpdatedAt: new Date().toISOString(),
  })
  if (!saved) {
    throw new Error("This listing is already linked to Shopify")
  }
}
