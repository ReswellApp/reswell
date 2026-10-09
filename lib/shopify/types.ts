import type { PeerListingSection } from "@/lib/peer-listing-sections"

/** Retained for the legacy storefront sort constants still imported on main. */
export type ProductSortKey = "RELEVANCE"
export type ProductCollectionSortKey = "BEST_SELLING"

export type ShopifyConnectionStatus =
  | "active"
  | "disconnected"
  | "reauthorization_required"
  | "error"

export type ShopifyCredentialProvider =
  | "public_oauth"
  | "merchant_custom"

export interface ShopifyConnectionRow {
  id: string
  user_id: string
  shop_domain: string
  shop_gid: string | null
  shop_name: string | null
  status: ShopifyConnectionStatus
  sync_enabled: boolean
  credential_provider: ShopifyCredentialProvider
  active_credential_id: string | null
  catalog_read_enabled: boolean
  sales_enabled: boolean
  inventory_write_enabled: boolean
  access_token_ciphertext: string
  access_token_iv: string
  access_token_tag: string
  refresh_token_ciphertext: string | null
  refresh_token_iv: string | null
  refresh_token_tag: string | null
  encryption_key_version: number
  token_expires_at: string | null
  refresh_token_expires_at: string | null
  token_refresh_locked_until: string | null
  token_refresh_lock_id: string | null
  scopes: string[]
  last_webhook_at: string | null
  last_reconciled_at: string | null
  last_error: string | null
  connected_at: string
  disconnected_at: string | null
  created_at: string
  updated_at: string
}

export type PublicShopifyConnection = Pick<
  ShopifyConnectionRow,
  | "id"
  | "shop_domain"
  | "shop_gid"
  | "shop_name"
  | "status"
  | "sync_enabled"
  | "credential_provider"
  | "catalog_read_enabled"
  | "sales_enabled"
  | "inventory_write_enabled"
  | "scopes"
  | "last_webhook_at"
  | "last_reconciled_at"
  | "last_error"
  | "connected_at"
>

export interface ShopifyCredentialRow {
  id: string
  connection_id: string
  provider: ShopifyCredentialProvider
  auth_mode: "expiring_oauth" | "client_credentials"
  status: "staged" | "active" | "grace" | "retired" | "revoked"
  client_id_ciphertext: string | null
  client_id_iv: string | null
  client_id_tag: string | null
  client_secret_ciphertext: string | null
  client_secret_iv: string | null
  client_secret_tag: string | null
  access_token_ciphertext: string
  access_token_iv: string
  access_token_tag: string
  refresh_token_ciphertext: string | null
  refresh_token_iv: string | null
  refresh_token_tag: string | null
  encryption_key_version: number
  token_expires_at: string | null
  refresh_token_expires_at: string | null
  scopes: string[]
  app_gid: string | null
  app_installation_gid: string | null
  webhook_route_key: string
  last_verified_at: string | null
}

export interface ShopifyPendingInstallationPreview {
  shopDomain: string
  shopName: string | null
  expiresAt: string
  ready: boolean
}

export interface ShopifyInventoryLevel {
  locationId: string
  locationName: string
  available: number
}

export interface ShopifyCatalogVariant {
  id: string
  title: string
  sku: string | null
  price: number
  compareAtPrice: number | null
  inventoryItemId: string
  available: number
  inventoryLevels: ShopifyInventoryLevel[]
  imageUrl: string | null
}

export interface ShopifyCatalogProduct {
  id: string
  title: string
  description: string
  vendor: string | null
  productType: string | null
  status: string
  updatedAt: string
  imageUrl: string | null
  variants: ShopifyCatalogVariant[]
  selected: boolean
  selectedSection: PeerListingSection | null
}

export interface ShopifyProductMappingRow {
  id: string
  connection_id: string
  listing_id: string
  shopify_product_gid: string
  shopify_variant_gid: string
  shopify_inventory_item_gid: string
  reswell_section: PeerListingSection
  selected: boolean
  inventory_generation: number
  sync_status: "synced" | "out_of_stock" | "deleted" | "unselected" | "error"
  remote_updated_at: string | null
  last_synced_at: string | null
  last_error: string | null
}

export interface ShopifyWebhookEventRow {
  id: string
  connection_id: string | null
  shop_domain: string
  webhook_id: string
  topic: string
  payload: Record<string, unknown>
  status: "queued" | "processing" | "retry" | "processed" | "dead"
  attempts: number
  max_attempts: number
  worker_id: string | null
}

export type ShopifySyncJobType =
  | "product_sync"
  | "product_delete"
  | "inventory_sync"
  | "inventory_decrement"
  | "reconcile_connection"

export interface ShopifySyncJobRow {
  id: string
  connection_id: string
  job_type: ShopifySyncJobType
  payload: Record<string, unknown>
  status: "queued" | "processing" | "retry" | "succeeded" | "dead" | "canceled"
  attempts: number
  max_attempts: number
  worker_id: string | null
}

export interface ShopifyShippingReadiness {
  hasShipFromAddress: boolean
  packageDefaults: Array<{
    section: PeerListingSection
    sectionLabel: string
    packageSizeId: string
    packageLabel: string
    packageSummary: string
  }>
}

export interface ShopifyDashboardData {
  enabled: boolean
  configured: boolean
  publicOAuthEnabled: boolean
  manualCanaryEnabled: boolean
  appInstallUrl: string | null
  connection: PublicShopifyConnection | null
  products: ShopifyCatalogProduct[]
  productPageInfo: {
    hasNextPage: boolean
    endCursor: string | null
  }
  shippingReadiness: ShopifyShippingReadiness
  loadError: string | null
}
