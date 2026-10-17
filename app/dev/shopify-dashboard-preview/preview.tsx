"use client"

import { ShopifyIntegrationDashboard } from "@/components/features/integrations/shopify/shopify-integration-dashboard"
import type {
  PublicShopifyConnection,
  ShopifyCatalogManagerData,
  ShopifyCatalogProduct,
  ShopifyDashboardData,
  ShopifyLinkedListing,
} from "@/lib/shopify/types"

const FOUR_DAYS_AGO = "2026-10-13T03:30:00.000Z"
const TWO_HOURS_AGO = "2026-10-17T01:30:00.000Z"

function connection(
  status: PublicShopifyConnection["status"],
): PublicShopifyConnection {
  return {
    id: "preview-connection",
    shop_domain: "reswell.myshopify.com",
    shop_gid: null,
    shop_name: "Reswell",
    status,
    sync_enabled: status === "active",
    credential_provider: "public_oauth",
    catalog_read_enabled: true,
    sales_enabled: true,
    inventory_write_enabled: true,
    scopes: [],
    last_webhook_at: FOUR_DAYS_AGO,
    last_reconciled_at: TWO_HOURS_AGO,
    last_error: null,
    connected_at: "2026-09-17T03:30:00.000Z",
  }
}

function listing(id: string, title: string): ShopifyLinkedListing {
  return {
    mappingId: id,
    listingId: `listing-${id}`,
    productId: `product-${id}`,
    variantId: `variant-${id}`,
    title,
    variantTitle: id === "1" ? "5'10\"" : null,
    imageUrl: null,
    price: 640,
    shopifyQuantity: 2,
    reswellStock: 0,
    reswellStatus: "removed",
    section: "surfboards",
    slug: "preview-board",
    syncStatus: "unselected",
    selected: false,
    lastSyncedAt: TWO_HOURS_AGO,
    shopifyProductStatus: "active",
    state: "unpublished",
    adminUrl: "https://admin.shopify.com",
  }
}

function catalog(listings: ShopifyLinkedListing[]): ShopifyCatalogManagerData {
  return {
    summary: {
      total: listings.length,
      live: 0,
      outOfStock: 0,
      deleted: 0,
      unpublished: listings.length,
      errors: 0,
      needsRemoval: 0,
    },
    health: {
      queuedJobs: 0,
      retryJobs: 0,
      deadJobs: 0,
      pendingInventoryWrites: 0,
      inventoryWritesEnabled: true,
    },
    listings: {
      listings,
      total: listings.length,
      page: 1,
      pageSize: 20,
      shopifyCheck: "ok",
      missingInShopify: 0,
    },
  }
}

const product: ShopifyCatalogProduct = {
  id: "gid://shopify/Product/1",
  title: "Daily Driver",
  description: "",
  vendor: "Reswell",
  productType: "Surfboard",
  status: "active",
  updatedAt: TWO_HOURS_AGO,
  imageUrl: null,
  variants: [
    {
      id: "gid://shopify/ProductVariant/1",
      title: "5'10\"",
      sku: null,
      price: 640,
      compareAtPrice: null,
      inventoryItemId: "gid://shopify/InventoryItem/1",
      available: 2,
      inventoryLevels: [],
      imageUrl: null,
    },
  ],
  selected: false,
  selectedSection: null,
}

function dashboard(mode: "connected" | "empty" | "disconnected" | "reconnect"): ShopifyDashboardData {
  const listings = mode === "connected" ? [listing("1", "Twinzer"), listing("2", "Step-down")] : []
  return {
    enabled: true,
    configured: true,
    connectOptions: { pluginAvailable: true },
    connection:
      mode === "disconnected"
        ? null
        : connection(mode === "reconnect" ? "reauthorization_required" : "active"),
    products: mode === "disconnected" ? [] : [product],
    productPageInfo: { hasNextPage: false, endCursor: null },
    catalog: mode === "disconnected" ? null : catalog(listings),
    shippingReadiness: { hasShipFromAddress: false, packageDefaults: [] },
    loadError: null,
  }
}

export function ShopifyDashboardPreview({
  mode,
}: {
  mode: "connected" | "empty" | "disconnected" | "reconnect"
}) {
  return (
    <div className="min-h-dvh w-full bg-[#f6f6f7] px-4 py-6 text-[#202223] sm:px-6 lg:px-8 lg:py-8">
      <ShopifyIntegrationDashboard
        key={mode}
        initialData={dashboard(mode)}
        connected={false}
        callbackError={null}
      />
    </div>
  )
}
