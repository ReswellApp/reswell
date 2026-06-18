import type { PeerListingSection } from "@/lib/peer-listing-sections"

export type ShopifyConnectionStatus = "active" | "disconnected" | "error"

export type ShopifyProductLinkSyncStatus = "synced" | "error" | "unmapped" | "archived"

export type ShopifySectionSignalType = "collection" | "product_type" | "tag"

export interface ShopifyRestImage {
  id: number
  src: string
  position: number
}

export interface ShopifyRestVariant {
  id: number
  product_id: number
  title: string
  price: string
  sku: string | null
  inventory_quantity: number
  option1: string | null
  option2: string | null
  option3: string | null
  updated_at: string
}

export interface ShopifyRestProduct {
  id: number
  title: string
  body_html: string | null
  vendor: string
  product_type: string
  tags: string
  handle: string
  updated_at: string
  images: ShopifyRestImage[]
  variants: ShopifyRestVariant[]
}

export interface ShopifyMappedVariant {
  product: ShopifyRestProduct
  variant: ShopifyRestVariant
  section: PeerListingSection
  title: string
  description: string
  price: number
  condition: "brand_new" | "excellent" | "very_good" | "good" | "fair" | "poor"
  brand: string | null
  model: string | null
  imageUrls: string[]
  facetFields: Record<string, string | null>
}

export type ShopifySyncMode = "manual" | "all" | "collections" | "tags"

export type ShopifyPricingMode = "mirror" | "markup" | "compare_at"

export interface ShopifyConnectionRow {
  id: string
  user_id: string
  shop_domain: string
  access_token: string
  scopes: string
  status: ShopifyConnectionStatus
  shop_name: string | null
  connected_at: string
  disconnected_at: string | null
  last_sync_at: string | null
  last_error: string | null
  api_version: string
  installed_via: "oauth" | "admin" | "app_store"
  uninstalled_at: string | null
  webhook_last_received_at: string | null
  sync_mode: ShopifySyncMode
  sync_collection_ids: string[]
  sync_tags: string[]
  auto_sync_enabled: boolean
  pricing_mode: ShopifyPricingMode
  markup_percent: number
  default_condition: string
  last_full_sync_at: string | null
}

export type ShopifySyncJobType =
  | "product_sync"
  | "product_delete"
  | "inventory_sync"
  | "order_push"
  | "fulfillment_push"
  | "order_cancel"
  | "full_catalog_sync"
  | "reconcile"

export type ShopifySyncJobStatus = "queued" | "running" | "succeeded" | "failed" | "dead"

export interface ShopifySyncJobRow {
  id: string
  user_id: string | null
  connection_id: string | null
  job_type: ShopifySyncJobType
  payload: Record<string, unknown>
  status: ShopifySyncJobStatus
  attempts: number
  max_attempts: number
  run_after: string
  locked_at: string | null
  locked_by: string | null
  last_error: string | null
  dedupe_key: string | null
  created_at: string
  updated_at: string
}

export type ShopifyOrderLinkStatus =
  | "pending"
  | "created"
  | "fulfilled"
  | "failed"
  | "cancelled"
  | "refunded"

export interface ShopifyOrderLinkRow {
  id: string
  user_id: string
  connection_id: string
  reswell_order_id: string
  listing_id: string | null
  shopify_variant_id: string | null
  shopify_order_id: string | null
  shopify_order_name: string | null
  shopify_fulfillment_id: string | null
  sync_status: ShopifyOrderLinkStatus
  attempts: number
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface ListingVariantRow {
  id: string
  listing_id: string
  shopify_variant_id: string | null
  title: string
  option1: string | null
  option2: string | null
  option3: string | null
  sku: string | null
  price: number
  compare_at_price: number | null
  stock_quantity: number
  reserved_quantity: number
  in_stock: boolean
  image_url: string | null
  position: number
}

export interface ShopifySectionMappingRow {
  id: string
  user_id: string
  connection_id: string | null
  signal_type: ShopifySectionSignalType
  signal_value: string
  reswell_section: PeerListingSection
  priority: number
}
