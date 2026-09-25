/**
 * Klaviyo Catalogs API ids and write payloads for Reswell listings.
 * Item external ids match the custom catalog feed `$id` and event `ProductID`.
 */

import { isPeerListingSection } from "@/lib/peer-listing-sections"
import {
  KLAVIYO_CATALOG_LIVE_INVENTORY_POLICY,
  KLAVIYO_CATALOG_LIVE_INVENTORY_QUANTITY,
  type KlaviyoCatalogFeedItem,
} from "@/lib/klaviyo/catalog-product"

export const KLAVIYO_CATALOG_INTEGRATION_TYPE = "$custom" as const
export const KLAVIYO_CATALOG_TYPE = "$default" as const
export const KLAVIYO_CATALOG_CATEGORY_EXTERNAL_ID = "ReswellListings"

export interface KlaviyoCatalogListingVisibility {
  status?: string | null
  hidden_from_site?: boolean | null
  archived_at?: string | null
  section?: string | null
}

export function isKlaviyoCatalogListingLive(
  listing: KlaviyoCatalogListingVisibility,
): boolean {
  if (listing.status !== "active") return false
  if (listing.hidden_from_site !== false) return false
  if (listing.archived_at != null && String(listing.archived_at).trim() !== "") return false
  return isPeerListingSection(listing.section)
}

export function klaviyoCatalogCompoundId(externalId: string): string {
  return `${KLAVIYO_CATALOG_INTEGRATION_TYPE}:::${KLAVIYO_CATALOG_TYPE}:::${externalId}`
}

export function klaviyoCatalogVariantExternalId(listingId: string): string {
  return `${listingId}-variant`
}

export function klaviyoCatalogItemPath(externalId: string): string {
  return `/api/catalog-items/${encodeURIComponent(klaviyoCatalogCompoundId(externalId))}/`
}

export function klaviyoCatalogItemVariantsPath(externalId: string): string {
  return `/api/catalog-items/${encodeURIComponent(klaviyoCatalogCompoundId(externalId))}/variants/`
}

export function klaviyoCatalogVariantPath(variantCompoundId: string): string {
  return `/api/catalog-variants/${encodeURIComponent(variantCompoundId)}/`
}

interface KlaviyoCatalogItemAttributes {
  external_id?: string
  integration_type?: typeof KLAVIYO_CATALOG_INTEGRATION_TYPE
  catalog_type?: typeof KLAVIYO_CATALOG_TYPE
  title: string
  description: string
  url: string
  price: number
  image_full_url: string
  published: boolean
}

interface KlaviyoCatalogVariantAttributes {
  external_id?: string
  integration_type?: typeof KLAVIYO_CATALOG_INTEGRATION_TYPE
  catalog_type?: typeof KLAVIYO_CATALOG_TYPE
  title: string
  description: string
  sku?: string
  inventory_quantity: number
  inventory_policy: number
  price: number
  url: string
  image_full_url: string
  published: boolean
}

export function klaviyoCatalogItemWriteBody(input: {
  externalId: string
  item: KlaviyoCatalogFeedItem
  published: boolean
  mode: "create" | "update"
}): { data: Record<string, unknown> } {
  const attributes: KlaviyoCatalogItemAttributes = {
    title: input.item.title,
    description: input.item.description,
    url: input.item.link,
    price: input.item.price,
    image_full_url: input.item.image_link,
    published: input.published,
  }
  if (input.mode === "create") {
    attributes.external_id = input.externalId
    attributes.integration_type = KLAVIYO_CATALOG_INTEGRATION_TYPE
    attributes.catalog_type = KLAVIYO_CATALOG_TYPE
  }

  const data: Record<string, unknown> = {
    type: "catalog-item",
    attributes,
  }
  if (input.mode === "update") {
    data.id = klaviyoCatalogCompoundId(input.externalId)
  } else {
    data.relationships = {
      categories: {
        data: [
          {
            type: "catalog-category",
            id: klaviyoCatalogCompoundId(KLAVIYO_CATALOG_CATEGORY_EXTERNAL_ID),
          },
        ],
      },
    }
  }
  return { data }
}

export function klaviyoCatalogVariantWriteBody(input: {
  listingId: string
  item: KlaviyoCatalogFeedItem
  published: boolean
  variantCompoundId?: string
  mode: "create" | "update"
}): { data: Record<string, unknown> } {
  const inStock = input.published
  const attributes: KlaviyoCatalogVariantAttributes = {
    title: input.item.title,
    description: input.item.description,
    inventory_quantity: inStock ? KLAVIYO_CATALOG_LIVE_INVENTORY_QUANTITY : 0,
    inventory_policy: inStock ? KLAVIYO_CATALOG_LIVE_INVENTORY_POLICY : 1,
    price: input.item.price,
    url: input.item.link,
    image_full_url: input.item.image_link,
    published: input.published,
  }
  if (input.mode === "create") {
    const externalId = klaviyoCatalogVariantExternalId(input.listingId)
    attributes.external_id = externalId
    attributes.sku = externalId
    attributes.integration_type = KLAVIYO_CATALOG_INTEGRATION_TYPE
    attributes.catalog_type = KLAVIYO_CATALOG_TYPE
  }

  const data: Record<string, unknown> = {
    type: "catalog-variant",
    attributes,
  }
  if (input.mode === "update") {
    data.id = input.variantCompoundId
  } else {
    data.relationships = {
      item: {
        data: {
          type: "catalog-item",
          id: klaviyoCatalogCompoundId(input.listingId),
        },
      },
    }
  }
  return { data }
}

export function klaviyoCatalogCategoryCreateBody(): { data: Record<string, unknown> } {
  return {
    data: {
      type: "catalog-category",
      attributes: {
        external_id: KLAVIYO_CATALOG_CATEGORY_EXTERNAL_ID,
        name: "Reswell listings",
        integration_type: KLAVIYO_CATALOG_INTEGRATION_TYPE,
        catalog_type: KLAVIYO_CATALOG_TYPE,
      },
    },
  }
}

/** Feed-managed catalogs reject Catalogs API writes. Stop retrying when Klaviyo says so. */
export function isKlaviyoCustomFeedManagedError(detail: string): boolean {
  return /custom catalog feed|managed by a (custom )?feed|cannot be updated via (the )?api/i.test(
    detail,
  )
}
