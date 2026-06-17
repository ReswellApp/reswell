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
